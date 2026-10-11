import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { requireRestaurantPlan, requireRoles } from '../../plugins/auth.js';
import { AppError } from '../../shared/errors/app-error.js';
import { errorResponseSchema } from '../../shared/schemas/common.js';
import { periodSchema, periodStart } from '../../shared/utils/period.js';

const tipSchema = z.object({
  id: z.string(),
  billId: z.string(),
  label: z.string().describe('"Table 12", "Takeaway #1044", "Delivery #1043"'),
  amountEtb: z.number().int(),
  source: z.enum(['bank', 'cash']),
  waiterId: z.string(),
  waiterName: z.string(),
  paidOut: z.boolean(),
  createdAt: z.string(),
});

const errors = {
  400: errorResponseSchema.describe('VALIDATION_ERROR'),
  401: errorResponseSchema.describe('UNAUTHORIZED'),
  402: errorResponseSchema.describe('SUBSCRIPTION_REQUIRED (restaurant plan only)'),
  403: errorResponseSchema.describe('FORBIDDEN'),
};

/** Restaurant Plus tips: extra money kept by the bill's waiter. Never counted as sales. */
export const tipRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', requireRestaurantPlan);
  const { prisma } = app;
  const security = [{ bearerAuth: [] }];

  app.get(
    '/tips',
    {
      preHandler: requireRoles('owner', 'manager', 'waiter'),
      schema: {
        tags: ['tips'],
        security,
        description:
          'Tips in the period (business days in Addis Ababa), newest first. Waiters always get ' +
          'only their own; owner/manager get all (mine=true: only their own).',
        querystring: z.object({
          period: periodSchema,
          mine: z
            .enum(['true', 'false'])
            .default('false')
            .transform((v) => v === 'true'),
        }),
        response: { 200: z.array(tipSchema), ...errors },
      },
    },
    async (request) => {
      const { auth } = request;
      const onlyMine = auth.role === 'waiter' || request.query.mine;
      const tips = await prisma.tip.findMany({
        where: {
          businessId: auth.businessId,
          createdAt: { gte: periodStart(request.query.period) },
          ...(onlyMine && { waiterId: auth.memberId }),
        },
        orderBy: { createdAt: 'desc' },
        include: {
          waiter: { select: { user: { select: { name: true } } } },
          bill: {
            select: {
              type: true,
              table: { select: { number: true } },
              orders: { orderBy: { number: 'asc' }, take: 1, select: { number: true } },
            },
          },
        },
      });
      return tips.map((tip) => ({
        id: tip.id,
        billId: tip.billId,
        label:
          tip.bill.type === 'dine'
            ? `Table ${tip.bill.table?.number ?? ''}`.trim()
            : `${tip.bill.type === 'takeaway' ? 'Takeaway' : 'Delivery'} #${tip.bill.orders[0]?.number ?? ''}`,
        amountEtb: tip.amountEtb,
        source: tip.source,
        waiterId: tip.waiterId,
        waiterName: tip.waiter.user.name,
        paidOut: tip.paidOut,
        createdAt: tip.createdAt.toISOString(),
      }));
    }
  );

  app.post(
    '/tips/mark-paid',
    {
      preHandler: requireRoles('owner', 'manager'),
      schema: {
        tags: ['tips'],
        security,
        description: 'Marks tips as paid out to their waiter (e.g. at the end of the day).',
        body: z.object({ tipIds: z.array(z.string().min(1).max(64)).min(1).max(500) }),
        response: {
          200: z.object({ updated: z.number().int() }),
          ...errors,
          404: errorResponseSchema.describe('NOT_FOUND (a tip of another business or unknown)'),
        },
      },
    },
    async (request) => {
      const ids = [...new Set(request.body.tipIds)];
      return prisma.$transaction(async (tx) => {
        const found = await tx.tip.count({
          where: { id: { in: ids }, businessId: request.auth.businessId },
        });
        if (found !== ids.length) throw new AppError('NOT_FOUND');
        const { count } = await tx.tip.updateMany({
          where: { id: { in: ids }, businessId: request.auth.businessId, paidOut: false },
          data: { paidOut: true, paidOutAt: new Date() },
        });
        return { updated: count };
      });
    }
  );
};
