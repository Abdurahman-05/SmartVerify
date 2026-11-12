import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import type { PaymentMethod, Prisma } from '../../generated/prisma/client.js';
import type { AuthContext } from '../../plugins/auth.js';
import { requireRestaurantPlan, requireRoles } from '../../plugins/auth.js';
import { AppError } from '../../shared/errors/app-error.js';
import { errorResponseSchema, idParamSchema } from '../../shared/schemas/common.js';
import {
  dayRange,
  daySchema,
  listPeriodSchema,
  listRange,
  periodSchema,
  periodStart,
} from '../../shared/utils/period.js';

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

/** The list only needs the first order's number (for the label), not every order and item. */
const listInclude = {
  recordedBy: { select: { user: { select: { name: true } } } },
  bill: {
    select: {
      type: true,
      totalEtb: true,
      waiter: { select: { user: { select: { name: true } } } },
      table: { select: { number: true } },
      orders: { orderBy: { number: 'asc' }, take: 1, select: { number: true } },
    },
  },
} satisfies Prisma.PaymentInclude;

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
        // Cancelled orders were never paid for.
        where: { cancelledAt: null },
        orderBy: { number: 'asc' },
        select: {
          number: true,
          items: { orderBy: { id: 'asc' }, select: { name: true, priceEtb: true, quantity: true } },
        },
      },
    },
  },
} satisfies Prisma.PaymentInclude;

type Row = Prisma.PaymentGetPayload<{ include: typeof listInclude }>;

/** A cash payment's tip and change come out of the cash; a bank tip comes out of the bank. */
export function split(row: Pick<Row, 'method' | 'cashEtb' | 'bankEtb' | 'tipEtb' | 'changeEtb'>) {
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

/** Cash = paid with any cash (cash, cash + bank); bank = paid with any bank money. */
const moneySchema = z.enum(['cash', 'bank']);
const moneyMethods = (money: z.infer<typeof moneySchema>): PaymentMethod[] =>
  money === 'cash' ? ['cash', 'cash_bank'] : ['bank', 'cash_bank'];

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
          'Payments of paid bills in the period, newest first. Waiters see only their own bills. ' +
          'Payments never change once saved, so `since` (an ISO time) returns only the ones ' +
          'recorded after it. `date` (YYYY-MM-DD) gives that one day (Addis Ababa) instead of ' +
          'the period; period `all` gives every payment (newest first, up to `limit`).',
        querystring: z.object({
          period: listPeriodSchema,
          date: daySchema.optional(),
          method: methodSchema.optional(),
          money: moneySchema.optional(),
          since: z.iso.datetime().optional(),
          before: z.iso
            .datetime()
            .optional()
            .describe('Only payments older than this time: the next page of a scrolling list'),
          limit: z.coerce.number().int().min(1).max(500).default(500),
        }),
        response: { 200: z.array(paymentSchema), ...errors },
      },
    },
    async (request) => {
      const { period, date, method, money, since, before, limit } = request.query;
      const range: { gte?: Date; lt?: Date } = date ? dayRange(date) : listRange(period);
      if (before && (!range.lt || new Date(before) < range.lt)) range.lt = new Date(before);
      const rows = await prisma.payment.findMany({
        where: {
          ...visiblePayments(request.auth),
          createdAt: { ...range, ...(since && { gt: new Date(since) }) },
          ...(method && { method: fromMethod(method) }),
          ...(money && { method: { in: moneyMethods(money) } }),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: listInclude,
      });
      return rows.map(toPayment);
    }
  );

  app.get(
    '/payments/summary',
    {
      preHandler: requireRoles('owner', 'manager', 'waiter'),
      schema: {
        tags: ['history'],
        security,
        description:
          'Totals for the Transactions screen (same rows as GET /payments, without loading ' +
          'them): number of payments, sales, and how many were paid with cash / bank money.',
        querystring: z.object({ period: listPeriodSchema, date: daySchema.optional() }),
        response: {
          200: z.object({
            count: z.number().int(),
            salesEtb: z.number().int(),
            cashCount: z.number().int(),
            bankCount: z.number().int(),
          }),
          ...errors,
        },
      },
    },
    async (request) => {
      const { period, date } = request.query;
      const where: Prisma.PaymentWhereInput = {
        ...visiblePayments(request.auth),
        createdAt: date ? dayRange(date) : listRange(period),
      };
      const [groups, sales] = await Promise.all([
        prisma.payment.groupBy({ by: ['method'], where, _count: { _all: true } }),
        prisma.bill.aggregate({ where: { payment: { is: where } }, _sum: { totalEtb: true } }),
      ]);
      const countOf = (methods: PaymentMethod[]) =>
        groups.filter((g) => methods.includes(g.method)).reduce((n, g) => n + g._count._all, 0);
      return {
        count: countOf(['cash', 'bank', 'cash_bank']),
        salesEtb: sales._sum.totalEtb ?? 0,
        cashCount: countOf(moneyMethods('cash')),
        bankCount: countOf(moneyMethods('bank')),
      };
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
      // The database adds everything up; only one small row per payment method comes back.
      // A waiter allowed to see reports: their own bills only.
      const where: Prisma.PaymentWhereInput = {
        businessId: auth.businessId,
        createdAt: { gte: periodStart(period) },
        ...(auth.role === 'waiter' && { bill: { is: { waiterId: auth.memberId } } }),
      };
      const [groups, billSales] = await Promise.all([
        prisma.payment.groupBy({
          by: ['method'],
          where,
          _count: { _all: true },
          _sum: { cashEtb: true, bankEtb: true, tipEtb: true, changeEtb: true },
        }),
        Promise.all(
          (['cash', 'bank', 'cash_bank'] as const).map(async (method) => ({
            method,
            sales:
              (
                await prisma.bill.aggregate({
                  where: { payment: { is: { ...where, method } } },
                  _sum: { totalEtb: true },
                })
              )._sum.totalEtb ?? 0,
          }))
        ),
      ]);
      const sums = groups.map((g) => ({
        method: g.method,
        count: g._count._all,
        sales: billSales.find((b) => b.method === g.method)?.sales ?? 0,
        cash: g._sum.cashEtb ?? 0,
        bank: g._sum.bankEtb ?? 0,
        tip: g._sum.tipEtb ?? 0,
        change: g._sum.changeEtb ?? 0,
      }));

      let cashEtb = 0;
      let bankEtb = 0;
      let tipsEtb = 0;
      let count = 0;
      const byMethod = new Map<Method, { count: number; totalEtb: number }>();
      for (const g of sums) {
        // split() is linear per payment method, so it works on the group's sums.
        const parts = split({
          method: g.method,
          cashEtb: g.cash,
          bankEtb: g.bank,
          tipEtb: g.tip,
          changeEtb: g.change,
        });
        cashEtb += parts.cashEtb;
        bankEtb += parts.bankEtb;
        tipsEtb += g.tip;
        count += g.count;
        byMethod.set(toMethod(g.method), { count: g.count, totalEtb: g.sales });
      }
      const totalEtb = cashEtb + bankEtb;
      const methods: Method[] = ['cash', 'bank', 'cash+bank'];
      return {
        period,
        totalEtb,
        count,
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
