import type { FastifyInstance } from 'fastify';

import { Prisma, type Plan, type Role } from '../../generated/prisma/client.js';
import type { AuthContext } from '../../plugins/auth.js';
import { hashPin, verifyAgainstDummy, verifyPin } from '../../services/pin-hasher.js';
import { hashSessionToken, newSessionToken } from '../../services/session-token.js';
import { AppError } from '../../shared/errors/app-error.js';

import { loadSessionUser } from './session-user.js';

/** Session length without and with "Remember me" (registration is always remembered). */
const SESSION_TTL_MS = 12 * 3_600_000;
const SESSION_REMEMBER_TTL_MS = 30 * 86_400_000;
/** Normal plan (and no plan yet): devices signed in at a time, across the whole business. */
export const NORMAL_DEVICE_LIMIT = 2;

export interface RegisterInput {
  fullName: string;
  businessName: string;
  phone: string;
  pin: string;
}

export interface SignInInput {
  phone: string;
  pin: string;
  rememberMe: boolean;
}

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

export function createAuthService(app: FastifyInstance) {
  const { prisma } = app;

  async function openSession(userId: string, memberId: string, rememberMe: boolean) {
    const token = newSessionToken();
    const expiresAt = new Date(
      Date.now() + (rememberMe ? SESSION_REMEMBER_TTL_MS : SESSION_TTL_MS)
    );
    await prisma.session.create({
      data: { tokenHash: hashSessionToken(token), userId, memberId, expiresAt },
    });
    return {
      token,
      expiresAt: expiresAt.toISOString(),
      user: await loadSessionUser(prisma, memberId),
    };
  }

  /**
   * Normal plan: before a new sign-in, make sure fewer than 2 devices are signed in. The same
   * person signing in again (new phone, reinstall) replaces their own older device first. The
   * owner is never locked out: the oldest other devices are signed out. Staff get DEVICE_LIMIT.
   */
  async function makeRoomForDevice(
    userId: string,
    businessId: string,
    role: Role,
    plan: Plan | null
  ) {
    if (plan === 'normal_multi' || plan === 'restaurant') return;
    const open = await prisma.session.findMany({
      where: { revokedAt: null, expiresAt: { gt: new Date() }, member: { businessId } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, userId: true },
    });
    const free = NORMAL_DEVICE_LIMIT - 1;
    if (open.length <= free) return;
    const others = open.filter((s) => s.userId !== userId);
    if (others.length > free && role !== 'owner') {
      throw new AppError('DEVICE_LIMIT', { limit: NORMAL_DEVICE_LIMIT });
    }
    const revoke = [
      ...open.filter((s) => s.userId === userId),
      ...others.slice(0, Math.max(others.length - free, 0)),
    ];
    await prisma.session.updateMany({
      where: { id: { in: revoke.map((s) => s.id) } },
      data: { revokedAt: new Date() },
    });
  }

  return {
    /** Creates the owner, the business (no plan yet) and the owner's membership. */
    async register(input: RegisterInput) {
      if (await prisma.user.findUnique({ where: { phone: input.phone } })) {
        throw new AppError('PHONE_TAKEN');
      }
      const pinHash = await hashPin(input.pin);
      try {
        const member = await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: { name: input.fullName, phone: input.phone, pinHash },
          });
          const business = await tx.business.create({
            data: { name: input.businessName, ownerId: user.id },
          });
          return tx.businessMember.create({
            data: { businessId: business.id, userId: user.id, role: 'owner' },
          });
        });
        return openSession(member.userId, member.id, true);
      } catch (error) {
        // Two sign-ups with the same phone at the same moment.
        if (isUniqueViolation(error)) throw new AppError('PHONE_TAKEN');
        throw error;
      }
    },

    /** Owner or active staff. Every failure looks the same to the caller. */
    async signIn(input: SignInInput) {
      const user = await prisma.user.findUnique({
        where: { phone: input.phone },
        include: { membership: { include: { business: true } } },
      });
      if (!user) {
        await verifyAgainstDummy(input.pin);
        throw new AppError('WRONG_CREDENTIALS');
      }
      const pinOk = await verifyPin(user.pinHash, input.pin);
      const member = user.membership;
      if (!pinOk || !member || !member.active || member.business.deactivatedAt) {
        throw new AppError('WRONG_CREDENTIALS');
      }
      await makeRoomForDevice(user.id, member.businessId, member.role, member.business.plan);
      return openSession(user.id, member.id, input.rememberMe);
    },

    async signOut(sessionId: string) {
      await prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
    },

    /**
     * Signed-in PIN change. The current PIN must be right; the new PIN has the role's length
     * (owner 6, staff 4). Other devices are signed out; this one stays signed in.
     */
    async changePin(auth: AuthContext, currentPin: string, newPin: string) {
      const length = auth.role === 'owner' ? 6 : 4;
      if (!new RegExp(`^\\d{${length}}$`).test(newPin)) {
        throw new AppError('VALIDATION_ERROR', { reason: 'pinLength', length });
      }
      if (newPin === currentPin) throw new AppError('VALIDATION_ERROR', { reason: 'samePin' });

      const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.userId } });
      if (!(await verifyPin(user.pinHash, currentPin))) throw new AppError('WRONG_CREDENTIALS');

      const pinHash = await hashPin(newPin);
      await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { pinHash, pinIsTemporary: false } }),
        prisma.session.updateMany({
          where: { userId: user.id, id: { not: auth.sessionId }, revokedAt: null },
          data: { revokedAt: new Date() },
        }),
      ]);
    },
  };
}
