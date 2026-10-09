import fastifyJwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import fp from 'fastify-plugin';

import type { Plan, Role } from '../generated/prisma/client.js';
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
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    auth: AuthContext;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sid: string };
    user: { sid: string };
  }
}

/** preHandler that allows only the given roles. */
export const requireRoles =
  (...roles: Role[]): preHandlerHookHandler =>
  async (request) => {
    if (!roles.includes(request.auth.role)) throw new AppError('FORBIDDEN');
  };

export default fp<{ jwtSecret: string }>(
  async (app, { jwtSecret }) => {
    await app.register(fastifyJwt, { secret: jwtSecret });

    app.decorate('authenticate', async (request: FastifyRequest) => {
      let sid: string;
      try {
        ({ sid } = await request.jwtVerify<{ sid: string }>());
      } catch {
        throw new AppError('UNAUTHORIZED');
      }

      const session = await app.prisma.session.findUnique({
        where: { id: sid },
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

/** Restaurant Plus features: allowed on the restaurant plan and while exploring without a plan. */
export const requireRestaurantPlan: preHandlerHookHandler = async (request) => {
  if (request.auth.plan === 'normal') throw new AppError('SUBSCRIPTION_REQUIRED');
};
