import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import type { PaymentMethod, Prisma } from '../../generated/prisma/client.js';
import type { AuthContext } from '../../plugins/auth.js';
import { requireRestaurantPlan, requireRoles } from '../../plugins/auth.js';
import { AppError } from '../../shared/errors/app-error.js';
import { errorResponseSchema, idParamSchema } from '../../shared/schemas/common.js';
import { periodSchema, periodStart } from '../../shared/utils/period.js';

const methodSchema = z.enum(['cash', 'bank', 'cash+bank']);
type Method = z.infer<typeof methodSchema>;
const toMethod = (m: PaymentMethod): Method => (m === 'cash_bank' ? 'cash+bank' : m);
const fromMethod = (m: Method): PaymentMethod => (m === 'cash+bank' ? 'cash_bank' : m);

const paymentSchema = z.object({
  id: z.string(),
  billId: z.string(),
  label: z.string().describe('"Table 12", "Takeaway #1044", "Delivery #1043"'),
  type: z.enum(['dine', 'takeaway', 'delivery']),
  method: methodSchema,
  salesEtb: z.number().int().describe('Bill total = money for the restaurant (tips excluded)'),
  cashEtb: z.number().int().describe('Cash part of the sale (change given back excluded)'),
  bankEtb: z.number().int().describe('Bank part of the sale (tip excluded)'),
  tipEtb: z.number().int(),
  changeEtb: z.number().int(),
  waiterName: z.string(),
  recordedBy: z.string(),
  createdAt: z.string(),
});

const paymentDetailSchema = paymentSchema.extend({
  foodTotalEtb: z.number().int(),
  packingFeeEtb: z.number().int(),
  deliveryFeeEtb: z.number().int(),
  items: z.array(
    z.object({ name: z.string(), priceEtb: z.number().int(), quantity: z.number().int() })
  ),
});

const include = {
  recordedBy: { select: { user: { select: { name: true } } } },
  bill: {
    select: {
      type: true,
      totalEtb: true,
      foodTotalEtb: true,
      packingFeeEtb: true,
      deliveryFeeEtb: true,
      waiterId: true,
      waiter: { select: { user: { select: { name: true } } } },
      table: { select: { number: true } },
      orders: {
        orderBy: { number: 'asc' },
        select: {
          number: true,
          items: { orderBy: { id: 'asc' }, select: { name: true, priceEtb: true, quantity: true } },
        },
      },
    },
  },
} satisfies Prisma.PaymentInclude;

type Row = Prisma.PaymentGetPayload<{ include: typeof include }>;

/** A cash payment's tip and change come out of the cash; a bank tip comes out of the bank. */
function split(row: Pick<Row, 'method' | 'cashEtb' | 'bankEtb' | 'tipEtb' | 'changeEtb'>) {
  const tipFromCash = row.method === 'cash' ? row.tipEtb : 0;
  return {
    cashEtb: row.cashEtb - row.changeEtb - tipFromCash,
    bankEtb: row.bankEtb - (row.tipEtb - tipFromCash),
  };
}

function toPayment(row: Row) {
  const { bill } = row;
  const first = bill.orders[0]?.number ?? '';
  return {
    id: row.id,
    billId: row.billId,
    label:
      bill.type === 'dine'
        ? `Table ${bill.table?.number ?? ''}`.trim()
        : `${bill.type === 'takeaway' ? 'Takeaway' : 'Delivery'} #${first}`,
    type: bill.type,
    method: toMethod(row.method),
    salesEtb: bill.totalEtb,
    ...split(row),
    tipEtb: row.tipEtb,
    changeEtb: row.changeEtb,
    waiterName: bill.waiter.user.name,
    recordedBy: row.recordedBy.user.name,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Waiters see the payments of their own bills; owner and manager see all. */
const visiblePayments = (auth: AuthContext): Prisma.PaymentWhereInput => ({
  businessId: auth.businessId,
  ...(auth.role === 'waiter' && { bill: { waiterId: auth.memberId } }),
});

const errors = {
  401: errorResponseSchema.describe('UNAUTHORIZED'),
  402: errorResponseSchema.describe('SUBSCRIPTION_REQUIRED (restaurant plan only)'),
  403: errorResponseSchema.describe('FORBIDDEN'),
};

/**
 * Restaurant Plus history and reports, built from paid bills (cash, bank, cash + bank).
 * Bank verification (verified / pending / mismatch) is not part of this yet.
 */
export const historyRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', requireRestaurantPlan);
  const { prisma } = app;
  const security = [{ bearerAuth: [] }];

  app.get(
    '/payments',
    {
      preHandler: requireRoles('owner', 'manager', 'waiter'),
      schema: {
        tags: ['history'],
        security,
        description:
          'Payments of paid bills in the period, newest first. Waiters see only their own bills.',
        querystring: z.object({ period: periodSchema, method: methodSchema.optional() }),
        response: { 200: z.array(paymentSchema), ...errors },
      },
    },
    async (request) => {
      const { period, method } = request.query;
      const rows = await prisma.payment.findMany({
        where: {
          ...visiblePayments(request.auth),
          createdAt: { gte: periodStart(period) },
          ...(method && { method: fromMethod(method) }),
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
        include,
      });
      return rows.map(toPayment);
    }
  );

  app.get(
    '/payments/:id',
    {
      preHandler: requireRoles('owner', 'manager', 'waiter'),
      schema: {
        tags: ['history'],
        security,
        params: idParamSchema,
        response: {
          200: paymentDetailSchema,
          ...errors,
          404: errorResponseSchema.describe('NOT_FOUND'),
        },
      },
    },
    async (request) => {
      const row = await prisma.payment.findFirst({
        where: { id: request.params.id, ...visiblePayments(request.auth) },
        include,
      });
      if (!row) throw new AppError('NOT_FOUND');
      return {
        ...toPayment(row),
        foodTotalEtb: row.bill.foodTotalEtb,
        packingFeeEtb: row.bill.packingFeeEtb,
        deliveryFeeEtb: row.bill.deliveryFeeEtb,
        items: row.bill.orders.flatMap((o) => o.items),
      };
    }
  );

  app.get(
    '/reports/payments',
    {
      preHandler: requireRoles('owner', 'manager', 'waiter'),
      schema: {
        tags: ['history'],
        security,
        description:
          'Sales in the period by payment method (tips not included). Owner, manager, or a ' +
          'waiter allowed to see reports (all bills of the business).',
        querystring: z.object({ period: periodSchema }),
        response: {
          200: z.object({
            period: z.enum(['today', '7d', '30d']),
            totalEtb: z.number().int(),
            count: z.number().int(),
            cashEtb: z.number().int(),
            bankEtb: z.number().int(),
            tipsEtb: z.number().int(),
            rows: z.array(
              z.object({
                method: methodSchema,
                count: z.number().int(),
                totalEtb: z.number().int(),
                share: z.number().int().describe('Percent of total sales, rounded'),
              })
            ),
          }),
          ...errors,
        },
      },
    },
    async (request) => {
      const { auth } = request;
      if (auth.role === 'waiter' && !auth.canSeeReports) throw new AppError('FORBIDDEN');
      const { period } = request.query;
      const payments = await prisma.payment.findMany({
        where: { businessId: auth.businessId, createdAt: { gte: periodStart(period) } },
        select: {
          method: true,
          cashEtb: true,
          bankEtb: true,
          tipEtb: true,
          changeEtb: true,
          bill: { select: { totalEtb: true } },
        },
      });

      let cashEtb = 0;
      let bankEtb = 0;
      let tipsEtb = 0;
      const byMethod = new Map<Method, { count: number; totalEtb: number }>();
      for (const p of payments) {
        const parts = split(p);
        cashEtb += parts.cashEtb;
        bankEtb += parts.bankEtb;
        tipsEtb += p.tipEtb;
        const m = toMethod(p.method);
        const entry = byMethod.get(m) ?? { count: 0, totalEtb: 0 };
        entry.count += 1;
        entry.totalEtb += p.bill.totalEtb;
        byMethod.set(m, entry);
      }
      const totalEtb = cashEtb + bankEtb;
      const methods: Method[] = ['cash', 'bank', 'cash+bank'];
      return {
        period,
        totalEtb,
        count: payments.length,
        cashEtb,
        bankEtb,
        tipsEtb,
        rows: methods.map((method) => {
          const entry = byMethod.get(method) ?? { count: 0, totalEtb: 0 };
          return {
            method,
            ...entry,
            share: totalEtb ? Math.round((entry.totalEtb / totalEtb) * 100) : 0,
          };
        }),
      };
    }
  );
};
