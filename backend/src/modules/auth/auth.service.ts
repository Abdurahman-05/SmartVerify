import type { FastifyInstance } from 'fastify';

import { Prisma, type Role } from '../../generated/prisma/client.js';
import type { AuthContext } from '../../plugins/auth.js';
import { hashPin, verifyAgainstDummy, verifyPin } from '../../services/pin-hasher.js';
import { hashSessionToken, newSessionToken } from '../../services/session-token.js';
import { AppError } from '../../shared/errors/app-error.js';

import { VERIFIED_FOR_MS } from './email-code.js';
import { loadSessionUser } from './session-user.js';

/** Session length without and with "Remember me" (registration is always remembered). */
const SESSION_TTL_MS = 12 * 3_600_000;
const SESSION_REMEMBER_TTL_MS = 30 * 86_400_000;

export interface RegisterInput {
  fullName: string;
  businessName: string;
  /** Lower case (the route trims and lower-cases it). */
  email: string;
  phone: string;
  pin: string;
}

/** Shop sign-up: phone + PIN only, no email. TODO: confirm the phone with an SMS code. */
export interface RegisterShopInput {
  fullName: string;
  businessName: string;
  phone: string;
  /** 4 digits. */
  pin: string;
}

/** Shop accounts lock after this many wrong PINs in a row, whatever the device. */
const PIN_MAX_FAILS = 5;
const PIN_LOCK_MS = 15 * 60_000;

export interface SignInInput {
  phone: string;
  pin: string;
  rememberMe: boolean;
}

export interface EmailSignInInput {
  /** Lower case (the route trims and lower-cases it). */
  email: string;
  pin: string;
  rememberMe: boolean;
}

const isUniqueViolation = (error: unknown): error is Prisma.PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

/** The column(s) of a unique violation, as text (e.g. "email"). */
const uniqueTarget = (error: Prisma.PrismaClientKnownRequestError) =>
  JSON.stringify(error.meta ?? {});

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

  return {
    /** Creates the owner, the business (no plan yet) and the owner's membership. */
    async register(input: RegisterInput) {
      if (await prisma.user.findUnique({ where: { phone: input.phone } })) {
        throw new AppError('PHONE_TAKEN');
      }
      if (await prisma.user.findUnique({ where: { email: input.email } })) {
        throw new AppError('EMAIL_TAKEN');
      }
      // The email must have been proved with a code a short while ago (POST /auth/verify-email).
      const proof = await prisma.emailCode.findFirst({
        where: {
          email: input.email,
          usedAt: null,
          verifiedAt: { gte: new Date(Date.now() - VERIFIED_FOR_MS) },
        },
        orderBy: { verifiedAt: 'desc' },
        select: { id: true },
      });
      if (!proof) throw new AppError('EMAIL_NOT_VERIFIED');
      const pinHash = await hashPin(input.pin);
      try {
        const member = await prisma.$transaction(async (tx) => {
          // One sign-up per proof, even if two arrive at once.
          const claimed = await tx.emailCode.updateMany({
            where: { id: proof.id, usedAt: null },
            data: { usedAt: new Date() },
          });
          if (claimed.count === 0) throw new AppError('EMAIL_NOT_VERIFIED');
          const user = await tx.user.create({
            data: { name: input.fullName, phone: input.phone, email: input.email, pinHash },
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
        // Two sign-ups with the same phone or email at the same moment.
        if (isUniqueViolation(error)) {
          throw new AppError(uniqueTarget(error).includes('email') ? 'EMAIL_TAKEN' : 'PHONE_TAKEN');
        }
        throw error;
      }
    },

    /** Shop owner: no email, no code. Creates the owner, the business (no plan yet) and the membership. */
    async registerShop(input: RegisterShopInput) {
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
        if (isUniqueViolation(error)) throw new AppError('PHONE_TAKEN');
        throw error;
      }
    },

    /** Owner or active staff. Every failure looks the same to the caller. */
    async signIn(input: SignInInput) {
      return checkPinAndOpen({ phone: input.phone }, input.pin, input.rememberMe);
    },

    /** Owner or manager by email (only they have one). Same token and user as phone sign-in. */
    async signInWithEmail(input: EmailSignInInput) {
      return checkPinAndOpen({ email: input.email }, input.pin, input.rememberMe, [
        'owner',
        'manager',
      ]);
    },

    async signOut(sessionId: string) {
      await prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
    },

    /**
     * Signed-in PIN change. The current PIN must be right; the new PIN has the role's length
     * (owner 6, staff 4). Other devices are signed out; this one stays signed in.
     */
    async changePin(auth: AuthContext, currentPin: string, newPin: string) {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.userId } });
      // A shop owner (no email) has a 4-digit PIN like staff; a restaurant owner has 6.
      const length = auth.role === 'owner' && user.email ? 6 : 4;
      if (!new RegExp(`^\\d{${length}}$`).test(newPin)) {
        throw new AppError('VALIDATION_ERROR', { reason: 'pinLength', length });
      }
      if (newPin === currentPin) throw new AppError('VALIDATION_ERROR', { reason: 'samePin' });

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

  /** Every failure (unknown user, wrong PIN, inactive member or business) looks the same. */
  async function checkPinAndOpen(
    where: { phone: string } | { email: string },
    pin: string,
    rememberMe: boolean,
    roles?: readonly Role[]
  ) {
    const user = await prisma.user.findUnique({
      where,
      include: { membership: { include: { business: true } } },
    });
    if (!user) {
      await verifyAgainstDummy(pin);
      throw new AppError('WRONG_CREDENTIALS');
    }
    const member = user.membership;
    // Shop accounts (a shop owner without email, or anyone in a Normal-plan business) are locked
    // for 15 minutes after 5 wrong PINs in a row. Restaurant accounts keep the IP limit only.
    const shopAccount =
      !!member &&
      (member.business.plan === 'normal' ||
        member.business.plan === 'normal_multi' ||
        (member.role === 'owner' && !user.email));
    if (shopAccount && user.pinLockedUntil && user.pinLockedUntil > new Date()) {
      throw new AppError('RATE_LIMITED');
    }
    const pinOk = await verifyPin(user.pinHash, pin);
    if (shopAccount) {
      const fails = pinOk ? 0 : user.failedPinAttempts + 1;
      const lock = !pinOk && fails >= PIN_MAX_FAILS;
      if (pinOk ? user.failedPinAttempts > 0 : true) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedPinAttempts: lock ? 0 : fails,
            pinLockedUntil: lock ? new Date(Date.now() + PIN_LOCK_MS) : null,
          },
        });
      }
    }
    if (
      !pinOk ||
      !member ||
      !member.active ||
      member.business.deactivatedAt ||
      (roles && !roles.includes(member.role))
    ) {
      throw new AppError('WRONG_CREDENTIALS');
    }
    return openSession(user.id, member.id, rememberMe);
  }
}
