import { createHash, randomBytes } from 'node:crypto';

import type { FastifyInstance, FastifyRequest } from 'fastify';

import type {
  AdminSessionStage,
  AdminUser,
  Prisma,
  PrismaClient,
} from '../../generated/prisma/client.js';
import { hashPin, verifyAgainstDummy, verifyPin } from '../../services/pin-hasher.js';
import { openSecret, sealSecret } from '../../services/secret-box.js';
import { hashSessionToken, newSessionToken } from '../../services/session-token.js';
import { matchTotp, newTotpSecret, otpauthUrl } from '../../services/totp.js';
import { AppError } from '../../shared/errors/app-error.js';

/** Wrong passwords or codes before the account locks, and for how long. */
export const MAX_FAILED_TRIES = 5;
const LOCK_MS = 15 * 60_000;
/** The password step must be finished with the code within this time. */
const PASSWORD_STAGE_MS = 10 * 60_000;
/** A full session never lasts longer than this, however active. */
const MAX_SESSION_MS = 12 * 60 * 60_000;
const BACKUP_CODES = 8;

export const hashPassword = (password: string) => hashPin(password);

const hashBackupCode = (code: string) =>
  createHash('sha256').update(code.replace(/[\s-]/g, '').toUpperCase()).digest('hex');

/** "4K9M-2QXA": 8 characters without look-alikes (no 0/O, 1/I/L). */
function newBackupCode(): string {
  const letters = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  let code = '';
  for (const byte of bytes) code += letters[byte % letters.length];
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export interface AdminContext {
  sessionId: string;
  admin: AdminUser;
  stage: AdminSessionStage;
}

declare module 'fastify' {
  interface FastifyRequest {
    admin: AdminContext;
  }
}

const bearerToken = (request: FastifyRequest) => {
  const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
};

/** Saves one admin action or sign-in. Never pass passwords, codes or tokens in `details`. */
export function recordActivity(
  prisma: PrismaClient,
  request: FastifyRequest,
  entry: {
    adminId: string | null;
    category: 'money' | 'customers' | 'rules' | 'sign_in' | 'private_data';
    action: string;
    businessId?: string;
    details?: Prisma.InputJsonValue;
  }
) {
  return prisma.adminActivity.create({
    data: {
      ...entry,
      ip: request.ip,
      userAgent: request.headers['user-agent']?.slice(0, 300) ?? null,
    },
  });
}

export function createAdminAuth(app: FastifyInstance) {
  const prisma = app.prisma;

  const secretKey = () => {
    const key = app.env.ADMIN_SECRET_KEY;
    if (!key) throw new AppError('ADMIN_NOT_CONFIGURED');
    return key;
  };

  async function newSession(
    request: FastifyRequest,
    admin: AdminUser,
    stage: AdminSessionStage
  ): Promise<string> {
    const token = newSessionToken();
    const now = Date.now();
    await prisma.adminSession.create({
      data: {
        tokenHash: hashSessionToken(token),
        adminId: admin.id,
        stage,
        expiresAt: new Date(now + (stage === 'full' ? MAX_SESSION_MS : PASSWORD_STAGE_MS)),
        userAgent: request.headers['user-agent']?.slice(0, 300) ?? null,
        ip: request.ip,
      },
    });
    return token;
  }

  /** One wrong password or code: counts towards the lock. */
  async function failedTry(request: FastifyRequest, admin: AdminUser, action: string) {
    const failed = admin.failedSignIns + 1;
    const locked = failed >= MAX_FAILED_TRIES;
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        failedSignIns: locked ? 0 : failed,
        lockedUntil: locked ? new Date(Date.now() + LOCK_MS) : admin.lockedUntil,
      },
    });
    await recordActivity(prisma, request, {
      adminId: admin.id,
      category: 'sign_in',
      action,
      details: { locked },
    });
    return { locked, triesLeft: locked ? 0 : MAX_FAILED_TRIES - failed };
  }

  const assertNotLocked = (admin: AdminUser) => {
    if (admin.lockedUntil && admin.lockedUntil > new Date()) {
      throw new AppError('ACCOUNT_LOCKED', { until: admin.lockedUntil.toISOString() });
    }
  };

  /** A full session after both steps (the password-stage token is already revoked). */
  async function finish(request: FastifyRequest, admin: AdminUser) {
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { failedSignIns: 0, lockedUntil: null, lastSignInAt: new Date() },
    });
    await recordActivity(prisma, request, {
      adminId: admin.id,
      category: 'sign_in',
      action: 'signed_in',
    });
    return newSession(request, admin, 'full');
  }

  return {
    /**
     * Step 1: email + password. Gives a short "password" session; the code (or its first
     * setup) finishes signing in.
     */
    async signIn(request: FastifyRequest, email: string, password: string) {
      secretKey();
      const admin = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase() } });
      if (!admin || !admin.active) {
        await verifyAgainstDummy(password);
        await recordActivity(prisma, request, {
          adminId: null,
          category: 'sign_in',
          action: 'sign_in_failed',
          details: { reason: 'unknown_email' },
        });
        throw new AppError('WRONG_CREDENTIALS');
      }
      assertNotLocked(admin);
      if (!(await verifyPin(admin.passwordHash, password))) {
        const { locked } = await failedTry(request, admin, 'sign_in_failed');
        throw locked ? new AppError('ACCOUNT_LOCKED') : new AppError('WRONG_CREDENTIALS');
      }
      const token = await newSession(request, admin, 'password');
      return { token, next: admin.totpEnabledAt ? ('code' as const) : ('setup' as const) };
    },

    /** Reads the bearer token: the admin and how far they signed in. Slides the idle timer. */
    async authenticate(request: FastifyRequest, stage: AdminSessionStage) {
      const token = bearerToken(request);
      if (!token) throw new AppError('UNAUTHORIZED');
      const session = await prisma.adminSession.findUnique({
        where: { tokenHash: hashSessionToken(token) },
        include: { admin: true },
      });
      const now = new Date();
      const idleLimit = session
        ? new Date(session.lastSeenAt.getTime() + session.admin.idleTimeoutMinutes * 60_000)
        : now;
      if (
        !session ||
        session.revokedAt ||
        session.expiresAt <= now ||
        !session.admin.active ||
        (session.stage === 'full' && idleLimit <= now) ||
        (stage === 'full' && session.stage !== 'full')
      ) {
        throw new AppError('UNAUTHORIZED');
      }
      // Only touch the row once a minute, not on every request.
      if (now.getTime() - session.lastSeenAt.getTime() > 60_000) {
        await prisma.adminSession.update({ where: { id: session.id }, data: { lastSeenAt: now } });
      }
      request.admin = { sessionId: session.id, admin: session.admin, stage: session.stage };
    },

    /** First sign-in: a new authenticator secret (replaced on each call until confirmed). */
    async startSetup(request: FastifyRequest) {
      const { admin } = request.admin;
      if (admin.totpEnabledAt) throw new AppError('FORBIDDEN');
      const secret = newTotpSecret();
      await prisma.adminUser.update({
        where: { id: admin.id },
        data: { totpSecretEnc: sealSecret(secret, secretKey()) },
      });
      return { secret, otpauthUrl: otpauthUrl(secret, admin.email) };
    },

    /** First code from the app: turns two-step on, gives the backup codes once, signs in. */
    async confirmSetup(request: FastifyRequest, code: string) {
      const { admin, sessionId } = request.admin;
      if (admin.totpEnabledAt || !admin.totpSecretEnc) throw new AppError('FORBIDDEN');
      assertNotLocked(admin);
      const step = matchTotp(openSecret(admin.totpSecretEnc, secretKey()), code, null);
      if (step === null) {
        const { locked, triesLeft } = await failedTry(request, admin, 'two_step_failed');
        throw locked ? new AppError('ACCOUNT_LOCKED') : new AppError('WRONG_CODE', { triesLeft });
      }
      const codes = Array.from({ length: BACKUP_CODES }, newBackupCode);
      await prisma.$transaction([
        prisma.adminBackupCode.deleteMany({ where: { adminId: admin.id } }),
        prisma.adminBackupCode.createMany({
          data: codes.map((c) => ({ adminId: admin.id, codeHash: hashBackupCode(c) })),
        }),
        prisma.adminUser.update({
          where: { id: admin.id },
          data: { totpEnabledAt: new Date(), totpLastStep: step, failedSignIns: 0 },
        }),
        prisma.adminSession.update({ where: { id: sessionId }, data: { revokedAt: new Date() } }),
      ]);
      await recordActivity(prisma, request, {
        adminId: admin.id,
        category: 'sign_in',
        action: 'two_step_enabled',
      });
      const token = await finish(request, admin);
      return { token, backupCodes: codes };
    },

    /** Step 2: the authenticator code or one backup code. */
    async verify(request: FastifyRequest, input: { code?: string; backupCode?: string }) {
      const { admin, sessionId } = request.admin;
      if (!admin.totpEnabledAt || !admin.totpSecretEnc) throw new AppError('FORBIDDEN');
      assertNotLocked(admin);

      let ok = false;
      let usedBackup = false;
      if (input.code) {
        const step = matchTotp(
          openSecret(admin.totpSecretEnc, secretKey()),
          input.code,
          admin.totpLastStep
        );
        if (step !== null) {
          ok = true;
          await prisma.adminUser.update({
            where: { id: admin.id },
            data: { totpLastStep: step },
          });
        }
      } else if (input.backupCode) {
        const used = await prisma.adminBackupCode.updateMany({
          where: { adminId: admin.id, codeHash: hashBackupCode(input.backupCode), usedAt: null },
          data: { usedAt: new Date() },
        });
        ok = used.count === 1;
        usedBackup = ok;
      }
      if (!ok) {
        const { locked, triesLeft } = await failedTry(request, admin, 'two_step_failed');
        throw locked ? new AppError('ACCOUNT_LOCKED') : new AppError('WRONG_CODE', { triesLeft });
      }
      await prisma.adminSession.update({
        where: { id: sessionId },
        data: { revokedAt: new Date() },
      });
      if (usedBackup) {
        await recordActivity(prisma, request, {
          adminId: admin.id,
          category: 'sign_in',
          action: 'backup_code_used',
        });
      }
      return { token: await finish(request, admin) };
    },

    async signOut(request: FastifyRequest) {
      await prisma.adminSession.update({
        where: { id: request.admin.sessionId },
        data: { revokedAt: new Date() },
      });
    },

    /** Unused backup codes left (shown on the settings page later). */
    backupCodesLeft: (adminId: string) =>
      prisma.adminBackupCode.count({ where: { adminId, usedAt: null } }),
  };
}
