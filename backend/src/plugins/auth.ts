import type { FastifyRequest, preHandlerHookHandler } from 'fastify';
import fp from 'fastify-plugin';

import type { Plan, Role } from '../generated/prisma/client.js';
import { hashSessionToken } from '../services/session-token.js';
import { AppError } from '../shared/errors/app-error.js';

/** Identity and permissions, always derived from the server-side session, never from the client. */
export interface AuthContext {
  sessionId: string;
  userId: string;
  memberId: string;
  businessId: string;
  role: Role;
  plan: Plan | null;
  canSeeReports: boolean;
  canChangeDeliveryFee: boolean;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
  }
  interface FastifyRequest {
    auth: AuthContext;
  }
}

/** preHandler that allows only the given roles. */
export const requireRoles =
  (...roles: Role[]): preHandlerHookHandler =>
  async (request) => {
    if (!roles.includes(request.auth.role)) throw new AppError('FORBIDDEN');
  };

const bearerToken = (request: FastifyRequest) => {
  const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
};

export default fp(
  async (app) => {
    // Every check runs on each request, so sign-out, expiry and deactivation apply immediately.
    app.decorate('authenticate', async (request: FastifyRequest) => {
      const token = bearerToken(request);
      if (!token) throw new AppError('UNAUTHORIZED');

      const session = await app.prisma.session.findUnique({
        where: { tokenHash: hashSessionToken(token) },
        include: { member: { include: { business: true } } },
      });
      const member = session?.member;
      if (
        !session ||
        !member ||
        session.revokedAt ||
        session.expiresAt <= new Date() ||
        !member.active ||
        member.business.deactivatedAt
      ) {
        throw new AppError('UNAUTHORIZED');
      }

      request.auth = {
        sessionId: session.id,
        userId: session.userId,
        memberId: member.id,
        businessId: member.businessId,
        role: member.role,
        plan: member.business.plan,
        canSeeReports: member.canSeeReports,
        canChangeDeliveryFee: member.canChangeDeliveryFee,
      };
    });
  },
  { name: 'auth', dependencies: ['prisma'] }
);
