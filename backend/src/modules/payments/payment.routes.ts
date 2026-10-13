import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { requireRestaurantPlan, requireRoles } from '../../plugins/auth.js';
import { errorResponseSchema, idParamSchema } from '../../shared/schemas/common.js';

import { createPaymentService } from './payment.service.js';

const etb = z.number().int().min(0).max(10_000_000);

const payResultSchema = z.object({
  status: z.enum(['paid', 'over', 'short']).describe('over = extra bank money became the tip'),
  billId: z.string(),
  method: z.enum(['cash', 'bank', 'cash+bank']),
  totalEtb: z.number().int(),
  cashEtb: z.number().int(),
  bankReceivedEtb: z.number().int().describe('All bank money received for the bill so far'),
  expectedBankEtb: z.number().int(),
  remainingEtb: z.number().int().describe('Still to pay by bank (short only)'),
  tipEtb: z.number().int(),
  changeEtb: z.number().int(),
});

/** Restaurant Plus: take payment for a bill (cash only, bank, cash + bank). */
export const paymentRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', requireRestaurantPlan);
  const { env } = app;
  // Until bank verification exists, bank amounts come from the app's (fake) bank check.
  // That is only accepted outside production unless switched on explicitly.
  const allowUnverifiedBank =
    env.ALLOW_UNVERIFIED_BANK_PAYMENTS === 'true' ||
    (env.ALLOW_UNVERIFIED_BANK_PAYMENTS === undefined && env.NODE_ENV !== 'production');
  const payments = createPaymentService(app.prisma, allowUnverifiedBank);

  app.post(
    '/bills/:id/payments',
    {
      preHandler: requireRoles('owner', 'manager', 'waiter'),
      schema: {
        tags: ['payments'],
        security: [{ bearerAuth: [] }],
        description:
          'Cash only: `{ method: "cash", cashEtb, extraChoice }` — cash must cover the total; the ' +
          "extra is the waiter's tip or change given back. Bank / cash+bank: one request per bank " +
          'scan with `bankReceivedEtb` (this scan). The server adds all scans: exact = paid, more ' +
          "= paid with the extra as the waiter's tip (or, with extraChoice giveback, given back from " +
          'the cash drawer as changeEtb), less = short (bill stays open, scan again). ' +
          'Waiters can pay only their own bills. BANK AMOUNTS ARE NOT VERIFIED YET (fake check in ' +
          'the app): refused in production unless ALLOW_UNVERIFIED_BANK_PAYMENTS=true.',
        params: idParamSchema,
        headers: z.object({
          'idempotency-key': z.string().min(8).max(100).describe('A new UUID per payment step'),
        }),
        body: z.discriminatedUnion('method', [
          z.object({
            method: z.literal('cash'),
            cashEtb: etb,
            extraChoice: z.enum(['tip', 'giveback']).default('tip'),
          }),
          z.object({
            method: z.literal('bank'),
            bankReceivedEtb: etb,
            reference: z.string().trim().min(1).max(60).optional(),
            extraChoice: z.enum(['tip', 'giveback']).default('tip'),
          }),
          z.object({
            method: z.literal('cash+bank'),
            cashEtb: etb,
            bankReceivedEtb: etb,
            reference: z.string().trim().min(1).max(60).optional(),
            extraChoice: z.enum(['tip', 'giveback']).default('tip'),
          }),
        ]),
        response: {
          200: payResultSchema,
          400: errorResponseSchema.describe('VALIDATION_ERROR (e.g. not enough cash)'),
          401: errorResponseSchema.describe('UNAUTHORIZED'),
          402: errorResponseSchema.describe('SUBSCRIPTION_REQUIRED (restaurant plan only)'),
          403: errorResponseSchema.describe('FORBIDDEN (chef)'),
          404: errorResponseSchema.describe('NOT_FOUND'),
          409: errorResponseSchema.describe('BILL_CLOSED (already paid)'),
          501: errorResponseSchema.describe('PAYMENT_NOT_CONFIGURED (bank, in production)'),
        },
      },
    },
    async (request) =>
      payments.pay(
        request.auth,
        request.params.id,
        request.body,
        request.headers['idempotency-key']
      )
  );
};
