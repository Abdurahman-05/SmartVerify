import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import type { BillingPeriod, Plan } from '../../generated/prisma/client.js';
import { requireRoles } from '../../plugins/auth.js';
import { AppError } from '../../shared/errors/app-error.js';
import { planSchema } from '../../shared/schemas/common.js';
import {
  currentSubscription,
  loadSessionUser,
  sessionUserSchema,
  subscriptionSchema,
} from '../auth/session-user.js';

/** Prices in integer ETB (same as the app's plans.ts). Restaurant Plus is monthly only. */
export const PRICES: Record<
  Plan,
  Partial<Record<BillingPeriod, { months: number; priceEtb: number }>>
> = {
  normal: { monthly: { months: 1, priceEtb: 700 }, quarterly: { months: 3, priceEtb: 1500 } },
  restaurant: { monthly: { months: 1, priceEtb: 4000 } },
};

const addMonths = (date: Date, months: number) => {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
};

export const subscriptionRoutes: FastifyPluginAsyncZod = async (app) => {
  const { prisma, env } = app;
  const ownerOnly = requireRoles('owner');

  app.get(
    '/subscription',
    {
      schema: {
        tags: ['subscription'],
        security: [{ bearerAuth: [] }],
        response: { 200: z.object({ subscription: subscriptionSchema.nullable() }) },
      },
    },
    async (request) => ({
      subscription: await currentSubscription(prisma, request.auth.businessId),
    })
  );

  /** "Explore" a plan without paying (Choose plan screen). */
  app.patch(
    '/business/plan',
    {
      preHandler: ownerOnly,
      schema: {
        tags: ['subscription'],
        security: [{ bearerAuth: [] }],
        body: z.object({ plan: planSchema }),
        response: { 200: sessionUserSchema },
      },
    },
    async (request) => {
      await prisma.business.update({
        where: { id: request.auth.businessId },
        data: { plan: request.body.plan },
      });
      return loadSessionUser(prisma, request.auth.memberId);
    }
  );

  app.post(
    '/subscription',
    {
      preHandler: ownerOnly,
      schema: {
        tags: ['subscription'],
        security: [{ bearerAuth: [] }],
        body: z.object({
          plan: planSchema,
          period: z.enum(['monthly', 'quarterly']).default('monthly'),
        }),
        response: { 201: subscriptionSchema },
      },
    },
    async (request, reply) => {
      // No payment provider yet: starting a paid plan without payment is allowed only in development.
      if (!env.ALLOW_UNPAID_SUBSCRIPTIONS) throw new AppError('PAYMENT_NOT_CONFIGURED');

      const { plan, period } = request.body;
      const price = PRICES[plan][period];
      if (!price)
        throw new AppError('VALIDATION_ERROR', {
          issues: [{ path: '/period', code: 'not_offered' }],
        });

      const businessId = request.auth.businessId;
      const startedAt = new Date();
      const sub = await prisma.$transaction(async (tx) => {
        await tx.subscription.updateMany({
          where: { businessId, status: 'active' },
          data: { status: 'cancelled' },
        });
        await tx.business.update({ where: { id: businessId }, data: { plan } });
        return tx.subscription.create({
          data: {
            businessId,
            plan,
            period,
            priceEtb: price.priceEtb,
            startedAt,
            endsAt: addMonths(startedAt, price.months),
          },
        });
      });
      return reply.status(201).send({
        plan: sub.plan,
        period: sub.period,
        priceEtb: sub.priceEtb,
        startedAt: sub.startedAt.toISOString(),
        endsAt: sub.endsAt.toISOString(),
      });
    }
  );
};
