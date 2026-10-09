import type { FastifyInstance } from 'fastify';

import { Prisma } from '../../generated/prisma/client.js';
import { hashPin, verifyAgainstDummy, verifyPin } from '../../services/pin-hasher.js';
import { AppError } from '../../shared/errors/app-error.js';

import { loadSessionUser } from './session-user.js';

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

export const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

export function createAuthService(app: FastifyInstance) {
  const { prisma, env } = app;

  async function openSession(userId: string, memberId: string, rememberMe: boolean) {
    const ttlMs = rememberMe
      ? env.SESSION_REMEMBER_TTL_DAYS * 86_400_000
      : env.SESSION_TTL_HOURS * 3_600_000;
    const expiresAt = new Date(Date.now() + ttlMs);
    const session = await prisma.session.create({ data: { userId, memberId, expiresAt } });
    const token = app.jwt.sign({ sid: session.id }, { expiresIn: Math.floor(ttlMs / 1000) });
    return {
      token,
      expiresAt: expiresAt.toISOString(),
      user: await loadSessionUser(prisma, memberId),
    };
  }

  return {
    /** Creates the owner, the business (no plan, no subscription) and the owner's membership. */
    async register(input: RegisterInput) {
      if (await prisma.user.findUnique({ where: { phone: input.phone } })) {
        throw new AppError('PHONE_TAKEN');
      }
      const pinHash = await hashPin(input.pin);
      try {
        const member = await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: { name: input.fullName.trim(), phone: input.phone, pinHash },
          });
          const business = await tx.business.create({
            data: { name: input.businessName.trim(), ownerId: user.id, plan: null },
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
      return openSession(user.id, member.id, input.rememberMe);
    },

    async signOut(sessionId: string) {
      await prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
    },
  };
}
