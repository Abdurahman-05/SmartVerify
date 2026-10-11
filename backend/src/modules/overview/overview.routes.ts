import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { requireRestaurantPlan, requireRoles } from '../../plugins/auth.js';
import { errorResponseSchema } from '../../shared/schemas/common.js';
import { periodSchema, periodStart } from '../../shared/utils/period.js';

const overviewSchema = z.object({
  period: z.enum(['today', '7d', '30d']),
  salesEtb: z.number().int().describe('Money for bills paid in the period (tips not included)'),
  cashEtb: z.number().int().describe('Cash part of sales (change given back excluded)'),
  bankEtb: z.number().int().describe('Bank part of sales'),
  tipsEtb: z.number().int().describe('Tips kept by waiters (not sales)'),
  paidBills: z.number().int(),
  orders: z.number().int().describe('Orders sent in the period'),
  openBills: z.number().int().describe('Bills not paid yet (right now)'),
  openTables: z.number().int().describe('Dine-in bills not paid yet (right now)'),
  deliveryFeeChanges: z.object({
    count: z.number().int(),
    latest: z.array(
      z.object({
        billId: z.string(),
        changedBy: z.string(),
        usualFeeEtb: z.number().int(),
        feeEtb: z.number().int(),
      })
    ),
  }),
});

/** Restaurant Plus: numbers for the owner / manager overview. */
export const overviewRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', requireRestaurantPlan);
  const { prisma } = app;

  app.get(
    '/overview',
    {
      preHandler: requireRoles('owner', 'manager'),
      schema: {
        tags: ['overview'],
        security: [{ bearerAuth: [] }],
        description:
          'Sales split into cash and bank, tips, orders and what needs attention. Periods are ' +
          'business days in Addis Ababa.',
        querystring: z.object({ period: periodSchema }),
        response: {
          200: overviewSchema,
          401: errorResponseSchema.describe('UNAUTHORIZED'),
          402: errorResponseSchema.describe('SUBSCRIPTION_REQUIRED (restaurant plan only)'),
          403: errorResponseSchema.describe('FORBIDDEN'),
        },
      },
    },
    async (request) => {
      const { businessId } = request.auth;
      const { period } = request.query;
      const since = periodStart(period);

      const [payments, orders, openBills, openTables, feeBills] = await Promise.all([
        prisma.payment.findMany({
          where: { businessId, createdAt: { gte: since } },
          select: { method: true, cashEtb: true, bankEtb: true, tipEtb: true, changeEtb: true },
        }),
        prisma.order.count({ where: { businessId, createdAt: { gte: since } } }),
        prisma.bill.count({ where: { businessId, status: 'open' } }),
        prisma.bill.count({ where: { businessId, status: 'open', type: 'dine' } }),
        prisma.bill.findMany({
          where: { businessId, createdAt: { gte: since }, deliveryFeeChangedById: { not: null } },
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            deliveryFeeEtb: true,
            usualDeliveryFeeEtb: true,
            deliveryFeeChangedBy: { select: { user: { select: { name: true } } } },
          },
        }),
      ]);

      // A cash payment's tip and change are taken out of the cash; a bank tip out of the bank.
      let cashEtb = 0;
      let bankEtb = 0;
      let tipsEtb = 0;
      for (const p of payments) {
        const tipFromCash = p.method === 'cash' ? p.tipEtb : 0;
        cashEtb += p.cashEtb - p.changeEtb - tipFromCash;
        bankEtb += p.bankEtb - (p.tipEtb - tipFromCash);
        tipsEtb += p.tipEtb;
      }

      const changed = feeBills.filter(
        (b) => b.usualDeliveryFeeEtb !== null && b.deliveryFeeEtb !== b.usualDeliveryFeeEtb
      );
      return {
        period,
        salesEtb: cashEtb + bankEtb,
        cashEtb,
        bankEtb,
        tipsEtb,
        paidBills: payments.length,
        orders,
        openBills,
        openTables,
        deliveryFeeChanges: {
          count: changed.length,
          latest: changed.slice(0, 5).map((b) => ({
            billId: b.id,
            changedBy: b.deliveryFeeChangedBy?.user.name ?? '',
            usualFeeEtb: b.usualDeliveryFeeEtb ?? 0,
            feeEtb: b.deliveryFeeEtb,
          })),
        },
      };
    }
  );
};
