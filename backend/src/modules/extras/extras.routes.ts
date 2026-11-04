import type { FastifyBaseLogger } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import type { Prisma, SpendingCategory } from '../../generated/prisma/client.js';
import { requireRestaurantPlan, requireRoles } from '../../plugins/auth.js';
import { AppError } from '../../shared/errors/app-error.js';
import { errorResponseSchema, idParamSchema } from '../../shared/schemas/common.js';
import { notify } from '../../services/notifications.js';
import { dayRange, daySchema, periodSchema, periodStart } from '../../shared/utils/period.js';
import { split } from '../history/history.routes.js';

const whenSchema = z.enum(['TODAY', 'WEEK']);
const statusSchema = z.enum(['OPEN', 'BOUGHT']);
const paidFromSchema = z.enum(['CASH', 'BANK']);
const categorySchema = z.enum([
  'FOOD',
  'DRINKS',
  'GAS',
  'RENT',
  'SALARY',
  'REPAIRS',
  'TRANSPORT',
  'BILLS',
  'OTHER',
]);
/** Integer ETB. */
const amountSchema = z.number().int().min(1).max(100_000_000);

const featuresSchema = z.object({
  featureBuyList: z.boolean(),
  featureMoneyOut: z.boolean(),
});

const buyItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  qty: z.string().nullable(),
  when: whenSchema,
  status: statusSchema,
  price: z.number().int().nullable(),
  paidFrom: paidFromSchema.nullable(),
  createdBy: z.string(),
  boughtBy: z.string().nullable(),
  createdAt: z.string(),
  boughtAt: z.string().nullable(),
});

const spendingSchema = z.object({
  id: z.string(),
  title: z.string(),
  amount: z.number().int(),
  category: categorySchema,
  paidFrom: paidFromSchema,
  buyItemId: z.string().nullable(),
  createdBy: z.string(),
  createdAt: z.string(),
  /** Added by someone else and not yet looked at by the owner. */
  isNew: z.boolean(),
  /** The owner's last change, and the amount before it. */
  changedAt: z.string().nullable(),
  changedBy: z.string().nullable(),
  oldAmount: z.number().int().nullable(),
  /** Deleted by the owner: still listed, never counted. */
  deletedAt: z.string().nullable(),
  deleteReason: z.string().nullable(),
  hasReceipt: z.boolean(),
  /** false: personal use, not the business's. */
  forBusiness: z.boolean(),
  /** A business cost: a kind the owner counts, with a receipt, for the business. */
  isCost: z.boolean(),
});

const moneySplitSchema = z.object({
  total: z.number().int(),
  cash: z.number().int(),
  bank: z.number().int(),
});

const errors = {
  401: errorResponseSchema.describe('UNAUTHORIZED'),
  402: errorResponseSchema.describe('SUBSCRIPTION_REQUIRED (restaurant plan only)'),
  403: errorResponseSchema.describe('FORBIDDEN (wrong role, or the feature is off)'),
};
const notFound = { 404: errorResponseSchema.describe('NOT_FOUND') };

const buyInclude = {
  createdBy: { select: { user: { select: { name: true } } } },
  boughtBy: { select: { user: { select: { name: true } } } },
} satisfies Prisma.BuyItemInclude;

const toBuyItem = (row: Prisma.BuyItemGetPayload<{ include: typeof buyInclude }>) => ({
  id: row.id,
  name: row.name,
  qty: row.qty,
  when: row.when,
  status: row.status,
  price: row.price,
  paidFrom: row.paidFrom,
  createdBy: row.createdBy.user.name,
  boughtBy: row.boughtBy?.user.name ?? null,
  createdAt: row.createdAt.toISOString(),
  boughtAt: row.boughtAt?.toISOString() ?? null,
});

const spendingInclude = {
  createdBy: { select: { role: true, user: { select: { name: true } } } },
} satisfies Prisma.SpendingInclude;

type SpendingRow = Prisma.SpendingGetPayload<{ include: typeof spendingInclude }>;

const toSpending = (row: SpendingRow, costKinds: readonly string[]) => ({
  id: row.id,
  title: row.title,
  amount: row.amount,
  category: row.category,
  paidFrom: row.paidFrom,
  buyItemId: row.buyItemId,
  createdBy: row.createdBy.user.name,
  createdAt: row.createdAt.toISOString(),
  isNew: row.createdBy.role !== 'owner' && !row.reviewedAt && !row.deletedAt,
  changedAt: row.changedAt?.toISOString() ?? null,
  changedBy: row.changedBy,
  oldAmount: row.oldAmount,
  deletedAt: row.deletedAt?.toISOString() ?? null,
  deleteReason: row.deleteReason,
  hasReceipt: row.hasReceipt,
  forBusiness: row.forBusiness,
  isCost: row.hasReceipt && row.forBusiness && costKinds.includes(row.category),
});

/** Expenses that count: not deleted by the owner. */
const counted = { deletedAt: null } satisfies Prisma.SpendingWhereInput;

/** Counted expenses that are business costs (the kinds the owner counts). */
const businessCost = (costKinds: SpendingCategory[]) =>
  ({
    ...counted,
    category: { in: costKinds },
    hasReceipt: true,
    forBusiness: true,
  }) satisfies Prisma.SpendingWhereInput;

/** The date range of a list: one day, from/to, or a period (default today). */
function spendingRange(q: {
  date?: string;
  period?: 'today' | '7d' | '30d';
  from?: string;
  to?: string;
}) {
  if (q.date) return dayRange(q.date);
  if (q.from) return { gte: new Date(q.from), ...(q.to && { lte: new Date(q.to) }) };
  return { gte: periodStart(q.period ?? 'today') };
}

/**
 * Owner extras (Restaurant Plus): the kitchen buy list and money out. The owner switches each on
 * or off; off only hides it (403 on its routes), nothing is ever deleted.
 */
export const extrasRoutes: FastifyPluginAsyncZod = async (app) => {
  const { prisma } = app;
  const security = [{ bearerAuth: [] }];

  /** Every expense someone else adds is told to the owner (it shows as new until checked). */
  const tellOwner = async (
    log: FastifyBaseLogger,
    auth: { businessId: string; role: string },
    row: SpendingRow
  ) => {
    if (auth.role === 'owner') return;
    await notify(prisma, log, {
      businessId: auth.businessId,
      to: { roles: ['owner'] },
      type: 'new_expense',
      data: {
        spendingId: row.id,
        name: row.createdBy.user.name,
        title: row.title,
        amountEtb: row.amount,
        paidFrom: row.paidFrom,
      },
    });
  };

  /** The two switches, as they are now. Both read false unless the business is on Restaurant Plus. */
  async function features(businessId: string) {
    const business = await prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { plan: true, featureBuyList: true, featureMoneyOut: true },
    });
    const restaurant = business.plan === 'restaurant';
    return {
      featureBuyList: restaurant && business.featureBuyList,
      featureMoneyOut: restaurant && business.featureMoneyOut,
    };
  }

  /** preHandler: 403 when the feature is off. */
  const needs =
    (feature: keyof Awaited<ReturnType<typeof features>>) =>
    async (request: { auth: { businessId: string } }) => {
      if (!(await features(request.auth.businessId))[feature]) {
        throw new AppError('FORBIDDEN', { reason: 'FEATURE_OFF', feature });
      }
    };

  // ─── Switches ──────────────────────────────────────────────────────────────

  app.get(
    '/business/features',
    {
      schema: {
        tags: ['extras'],
        security,
        description:
          'Which owner extras are on, so the app knows what to show. Any member. Both are false ' +
          'unless the business is on Restaurant Plus.',
        response: { 200: featuresSchema, 401: errors[401] },
      },
    },
    async (request) => features(request.auth.businessId)
  );

  app.patch(
    '/business/features',
    {
      preHandler: [requireRoles('owner'), requireRestaurantPlan],
      schema: {
        tags: ['extras'],
        security,
        description: 'Owner only. Turning a feature off only hides it: its data is kept.',
        body: z
          .object({
            featureBuyList: z.boolean().optional(),
            featureMoneyOut: z.boolean().optional(),
          })
          .refine((b) => Object.values(b).some((v) => v !== undefined), {
            message: 'Nothing to change',
          }),
        response: { 200: featuresSchema, 400: errorResponseSchema, ...errors },
      },
    },
    async (request) => {
      await prisma.business.update({
        where: { id: request.auth.businessId },
        data: request.body,
      });
      return features(request.auth.businessId);
    }
  );

  // ─── Buy list ──────────────────────────────────────────────────────────────

  const buyListRoutes: FastifyPluginAsyncZod = async (buy) => {
    buy.addHook('preHandler', requireRestaurantPlan);
    buy.addHook('preHandler', needs('featureBuyList'));

    buy.post(
      '/buy-items',
      {
        preHandler: requireRoles('chef', 'owner'),
        schema: {
          tags: ['extras'],
          security,
          description: 'Add something the kitchen has run out of. Chef or owner.',
          body: z.object({
            name: z.string().trim().min(1).max(80),
            qty: z.string().trim().max(40).optional(),
            when: whenSchema,
          }),
          response: { 201: buyItemSchema, 400: errorResponseSchema, ...errors },
        },
      },
      async (request, reply) => {
        const { auth, body } = request;
        const row = await prisma.buyItem.create({
          data: {
            businessId: auth.businessId,
            name: body.name,
            qty: body.qty || null,
            when: body.when,
            createdById: auth.memberId,
          },
          include: buyInclude,
        });
        return reply.status(201).send(toBuyItem(row));
      }
    );

    buy.get(
      '/buy-items',
      {
        preHandler: requireRoles('chef', 'manager', 'owner'),
        schema: {
          tags: ['extras'],
          security,
          description: 'The buy list, newest first. Optional status filter.',
          querystring: z.object({ status: statusSchema.optional() }),
          response: { 200: z.array(buyItemSchema), ...errors },
        },
      },
      async (request) => {
        const rows = await prisma.buyItem.findMany({
          where: {
            businessId: request.auth.businessId,
            ...(request.query.status && { status: request.query.status }),
          },
          orderBy: { createdAt: 'desc' },
          take: 300,
          include: buyInclude,
        });
        return rows.map(toBuyItem);
      }
    );

    buy.delete(
      '/buy-items/:id',
      {
        preHandler: requireRoles('chef', 'owner'),
        schema: {
          tags: ['extras'],
          security,
          description:
            'Remove an item. A chef: only their own, only while OPEN. The owner: any item.',
          params: idParamSchema,
          response: { 204: z.null(), ...errors, ...notFound },
        },
      },
      async (request, reply) => {
        const { auth } = request;
        const item = await prisma.buyItem.findFirst({
          where: { id: request.params.id, businessId: auth.businessId },
          include: { spending: { select: { id: true } } },
        });
        if (!item) throw new AppError('NOT_FOUND');
        if (
          auth.role === 'chef' &&
          (item.createdById !== auth.memberId || item.status !== 'OPEN')
        ) {
          throw new AppError('FORBIDDEN');
        }
        // A bought item has a spending row pointing at it: it goes first (the owner's choice).
        await prisma.$transaction([
          ...(item.spending ? [prisma.spending.delete({ where: { id: item.spending.id } })] : []),
          prisma.buyItem.delete({ where: { id: item.id } }),
        ]);
        return reply.status(204).send(null);
      }
    );

    buy.post(
      '/buy-items/:id/bought',
      {
        preHandler: requireRoles('manager', 'owner'),
        schema: {
          tags: ['extras'],
          security,
          description:
            'Mark an item as bought, with its price and where the money came from. With Money ' +
            'out on, a spending is added too. Only an OPEN item (else CONFLICT).',
          params: idParamSchema,
          body: z.object({ price: amountSchema, paidFrom: paidFromSchema }),
          response: {
            200: buyItemSchema,
            400: errorResponseSchema,
            409: errorResponseSchema.describe('CONFLICT (already bought)'),
            ...errors,
            ...notFound,
          },
        },
      },
      async (request) => {
        const { auth, body } = request;
        const moneyOut = (await features(auth.businessId)).featureMoneyOut;
        let spent: SpendingRow | null = null;
        const result = await prisma.$transaction(async (tx) => {
          // Claim it first, so two people marking it bought at once cannot both win.
          const claimed = await tx.buyItem.updateMany({
            where: { id: request.params.id, businessId: auth.businessId, status: 'OPEN' },
            data: {
              status: 'BOUGHT',
              price: body.price,
              paidFrom: body.paidFrom,
              boughtById: auth.memberId,
              boughtAt: new Date(),
            },
          });
          const row = await tx.buyItem.findFirst({
            where: { id: request.params.id, businessId: auth.businessId },
            include: buyInclude,
          });
          if (!row) throw new AppError('NOT_FOUND');
          if (claimed.count === 0) throw new AppError('CONFLICT');
          if (moneyOut) {
            spent = await tx.spending.create({
              data: {
                businessId: auth.businessId,
                title: row.qty ? `${row.name} (${row.qty})` : row.name,
                amount: body.price,
                category: 'FOOD',
                paidFrom: body.paidFrom,
                buyItemId: row.id,
                createdById: auth.memberId,
              },
              include: spendingInclude,
            });
          }
          return toBuyItem(row);
        });
        if (spent) await tellOwner(request.log, auth, spent);
        return result;
      }
    );
  };
  await app.register(buyListRoutes);

  // ─── Money out ─────────────────────────────────────────────────────────────

  /** The kinds this business counts as business costs. */
  const costKindsOf = async (businessId: string) =>
    (
      await prisma.business.findUniqueOrThrow({
        where: { id: businessId },
        select: { costKinds: true },
      })
    ).costKinds;

  const moneyOutRoutes: FastifyPluginAsyncZod = async (money) => {
    money.addHook('preHandler', requireRestaurantPlan);
    money.addHook('preHandler', needs('featureMoneyOut'));

    money.get(
      '/business/cost-kinds',
      {
        preHandler: requireRoles('manager', 'owner'),
        schema: {
          tags: ['extras'],
          security,
          description: 'Expense kinds the owner counts as business costs.',
          response: { 200: z.object({ kinds: z.array(categorySchema) }), ...errors },
        },
      },
      async (request) => ({ kinds: await costKindsOf(request.auth.businessId) })
    );

    money.put(
      '/business/cost-kinds',
      {
        preHandler: requireRoles('owner'),
        schema: {
          tags: ['extras'],
          security,
          description: 'Owner: which expense kinds count as business costs (past ones too).',
          body: z.object({ kinds: z.array(categorySchema).max(categorySchema.options.length) }),
          response: { 200: z.object({ kinds: z.array(categorySchema) }), ...errors },
        },
      },
      async (request) => {
        const kinds = [...new Set(request.body.kinds)];
        await prisma.business.update({
          where: { id: request.auth.businessId },
          data: { costKinds: kinds },
        });
        return { kinds };
      }
    );

    money.post(
      '/spendings',
      {
        preHandler: requireRoles('manager', 'owner'),
        schema: {
          tags: ['extras'],
          security,
          description: 'Record money paid out. Manager or owner. Not a sale: reports ignore it.',
          body: z.object({
            title: z.string().trim().min(1).max(80),
            amount: amountSchema,
            category: categorySchema,
            paidFrom: paidFromSchema,
            hasReceipt: z.boolean().default(true),
            forBusiness: z.boolean().default(true),
          }),
          response: { 201: spendingSchema, 400: errorResponseSchema, ...errors },
        },
      },
      async (request, reply) => {
        const { auth, body } = request;
        const row = await prisma.spending.create({
          data: { ...body, businessId: auth.businessId, createdById: auth.memberId },
          include: spendingInclude,
        });
        await tellOwner(request.log, auth, row);
        return reply.status(201).send(toSpending(row, await costKindsOf(auth.businessId)));
      }
    );

    money.get(
      '/spendings',
      {
        preHandler: requireRoles('manager', 'owner'),
        schema: {
          tags: ['extras'],
          security,
          description:
            'Entries newest first (at most 200) between from and to (default: today). Totals: ' +
            '`today` and `week` (last 7 days) are always for those periods; `cash` and `bank` ' +
            'add up the entries returned.',
          querystring: z.object({
            from: z.iso.datetime().optional(),
            to: z.iso.datetime().optional(),
            period: periodSchema.optional(),
            date: daySchema.optional(),
          }),
          response: {
            200: z.object({
              entries: z.array(spendingSchema),
              totals: z.object({
                today: z.number().int(),
                week: z.number().int(),
                cash: z.number().int(),
                bank: z.number().int(),
              }),
              newCount: z.number().int().describe('Not yet looked at by the owner'),
            }),
            400: errorResponseSchema,
            ...errors,
          },
        },
      },
      async (request) => {
        const { businessId } = request.auth;
        const range = spendingRange(request.query);
        const sum = async (where: Prisma.SpendingWhereInput) =>
          (
            await prisma.spending.aggregate({
              where: { businessId, ...counted, ...where },
              _sum: { amount: true },
            })
          )._sum.amount ?? 0;

        const [rows, today, week, cash, bank] = await Promise.all([
          prisma.spending.findMany({
            where: { businessId, createdAt: range },
            orderBy: { createdAt: 'desc' },
            take: 200,
            include: spendingInclude,
          }),
          sum({ createdAt: { gte: periodStart('today') } }),
          sum({ createdAt: { gte: periodStart('7d') } }),
          sum({ createdAt: range, paidFrom: 'CASH' }),
          sum({ createdAt: range, paidFrom: 'BANK' }),
        ]);
        const kinds = await costKindsOf(businessId);
        const entries = rows.map((row) => toSpending(row, kinds));
        return {
          entries,
          totals: { today, week, cash, bank },
          newCount: entries.filter((e) => e.isNew).length,
        };
      }
    );

    /** One expense of this business, or 404. */
    const findSpending = async (businessId: string, id: string) => {
      const row = await prisma.spending.findFirst({
        where: { id, businessId },
        include: spendingInclude,
      });
      if (!row) throw new AppError('NOT_FOUND');
      return row;
    };

    money.get(
      '/spendings/:id',
      {
        preHandler: requireRoles('manager', 'owner'),
        schema: {
          tags: ['extras'],
          security,
          params: idParamSchema,
          response: { 200: spendingSchema, ...errors, ...notFound },
        },
      },
      async (request) => {
        const { businessId } = request.auth;
        return toSpending(
          await findSpending(businessId, request.params.id),
          await costKindsOf(businessId)
        );
      }
    );

    money.post(
      '/spendings/:id/review',
      {
        preHandler: requireRoles('owner'),
        schema: {
          tags: ['extras'],
          security,
          description: 'Owner: "looks right". It is no longer new.',
          params: idParamSchema,
          response: { 200: spendingSchema, ...errors, ...notFound },
        },
      },
      async (request) => {
        const before = await findSpending(request.auth.businessId, request.params.id);
        const row = await prisma.spending.update({
          where: { id: before.id },
          data: { reviewedAt: new Date() },
          include: spendingInclude,
        });
        return toSpending(row, await costKindsOf(request.auth.businessId));
      }
    );

    money.patch(
      '/spendings/:id',
      {
        preHandler: requireRoles('owner'),
        schema: {
          tags: ['extras'],
          security,
          description:
            'Owner: correct an expense. The change is kept on it (who, when, the amount ' +
            'before), and it counts as looked at. A deleted one cannot be changed (409).',
          params: idParamSchema,
          body: z.object({
            title: z.string().trim().min(1).max(80).optional(),
            amount: amountSchema.optional(),
            category: categorySchema.optional(),
            paidFrom: paidFromSchema.optional(),
            hasReceipt: z.boolean().optional(),
            forBusiness: z.boolean().optional(),
          }),
          response: { 200: spendingSchema, 409: errorResponseSchema, ...errors, ...notFound },
        },
      },
      async (request) => {
        const { auth, body } = request;
        const before = await findSpending(auth.businessId, request.params.id);
        if (before.deletedAt) throw new AppError('CONFLICT');
        const owner = await prisma.businessMember.findUniqueOrThrow({
          where: { id: auth.memberId },
          select: { user: { select: { name: true } } },
        });
        const now = new Date();
        const amountChanged = body.amount !== undefined && body.amount !== before.amount;
        const row = await prisma.spending.update({
          where: { id: before.id },
          data: {
            ...body,
            changedAt: now,
            changedBy: owner.user.name,
            reviewedAt: now,
            ...(amountChanged && { oldAmount: before.amount }),
          },
          include: spendingInclude,
        });
        return toSpending(row, await costKindsOf(auth.businessId));
      }
    );

    money.post(
      '/spendings/:id/delete',
      {
        preHandler: requireRoles('owner'),
        schema: {
          tags: ['extras'],
          security,
          description:
            'Owner: delete an expense with a reason. It stays in the list (crossed out) and ' +
            'leaves every total. The person who added it is told.',
          params: idParamSchema,
          body: z.object({ reason: z.string().trim().min(1).max(120) }),
          response: { 200: spendingSchema, ...errors, ...notFound },
        },
      },
      async (request) => {
        const { auth, body } = request;
        const before = await findSpending(auth.businessId, request.params.id);
        const kinds = await costKindsOf(auth.businessId);
        if (before.deletedAt) return toSpending(before, kinds);
        const row = await prisma.spending.update({
          where: { id: before.id },
          data: { deletedAt: new Date(), deleteReason: body.reason },
          include: spendingInclude,
        });
        if (row.createdById !== auth.memberId) {
          await notify(prisma, request.log, {
            businessId: auth.businessId,
            to: { memberIds: [row.createdById] },
            type: 'expense_deleted',
            data: {
              spendingId: row.id,
              title: row.title,
              amountEtb: row.amount,
              reason: body.reason,
            },
          });
        }
        return toSpending(row, kinds);
      }
    );

    money.get(
      '/money-flow',
      {
        preHandler: requireRoles('owner', 'manager'),
        schema: {
          tags: ['extras'],
          security,
          description:
            'Owner (or a manager allowed to see reports): sales, expenses and what is left in ' +
            'the period or on one `date` (YYYY-MM-DD), each split into cash and bank. Sales are ' +
            'the money the restaurant kept (tips and change given back left out). Deleted ' +
            'expenses never count.',
          querystring: z.object({ period: periodSchema, date: daySchema.optional() }),
          response: {
            200: z.object({
              sales: moneySplitSchema,
              expenses: moneySplitSchema,
              left: moneySplitSchema,
              costs: moneySplitSchema.describe('Business costs (kinds the owner counts)'),
              other: moneySplitSchema.describe('Everything else spent'),
              profit: z.number().int().describe('Sales minus business costs'),
              byCategory: z.array(
                z.object({
                  category: categorySchema,
                  amount: z.number().int(),
                  share: z.number().int().describe('Percent of all expenses, rounded'),
                })
              ),
              newCount: z.number().int().describe('Expenses not yet looked at by the owner'),
            }),
            ...errors,
          },
        },
      },
      async (request) => {
        const { auth } = request;
        if (auth.role === 'manager' && !auth.canSeeReports) throw new AppError('FORBIDDEN');
        const { period, date } = request.query;
        const createdAt = date ? dayRange(date) : { gte: periodStart(period) };
        const { businessId } = auth;

        const kinds = await costKindsOf(businessId);
        const [payments, spent, costs, categories, fresh] = await Promise.all([
          prisma.payment.groupBy({
            by: ['method'],
            where: { businessId, createdAt },
            _sum: { cashEtb: true, bankEtb: true, tipEtb: true, changeEtb: true },
          }),
          prisma.spending.groupBy({
            by: ['paidFrom'],
            where: { businessId, ...counted, createdAt },
            _sum: { amount: true },
          }),
          prisma.spending.groupBy({
            by: ['paidFrom'],
            where: { businessId, ...businessCost(kinds), createdAt },
            _sum: { amount: true },
          }),
          prisma.spending.groupBy({
            by: ['category'],
            where: { businessId, ...counted, createdAt },
            _sum: { amount: true },
          }),
          prisma.spending.count({
            where: {
              businessId,
              ...counted,
              reviewedAt: null,
              createdBy: { role: { not: 'owner' } },
            },
          }),
        ]);

        let salesCash = 0;
        let salesBank = 0;
        for (const g of payments) {
          // split() is linear per payment method, so it works on the group's sums.
          const parts = split({
            method: g.method,
            cashEtb: g._sum.cashEtb ?? 0,
            bankEtb: g._sum.bankEtb ?? 0,
            tipEtb: g._sum.tipEtb ?? 0,
            changeEtb: g._sum.changeEtb ?? 0,
          });
          salesCash += parts.cashEtb;
          salesBank += parts.bankEtb;
        }
        const outCash = spent.find((g) => g.paidFrom === 'CASH')?._sum.amount ?? 0;
        const outBank = spent.find((g) => g.paidFrom === 'BANK')?._sum.amount ?? 0;
        const outTotal = outCash + outBank;
        const split3 = (cash: number, bank: number) => ({ total: cash + bank, cash, bank });
        const costCash = costs.find((g) => g.paidFrom === 'CASH')?._sum.amount ?? 0;
        const costBank = costs.find((g) => g.paidFrom === 'BANK')?._sum.amount ?? 0;

        return {
          sales: split3(salesCash, salesBank),
          expenses: split3(outCash, outBank),
          left: split3(salesCash - outCash, salesBank - outBank),
          costs: split3(costCash, costBank),
          other: split3(outCash - costCash, outBank - costBank),
          profit: salesCash + salesBank - (costCash + costBank),
          byCategory: categories
            .map((g) => ({ category: g.category, amount: g._sum.amount ?? 0 }))
            .sort((a, b) => b.amount - a.amount)
            .map((c) => ({
              ...c,
              share: outTotal ? Math.round((c.amount / outTotal) * 100) : 0,
            })),
          newCount: fresh,
        };
      }
    );
  };
  await app.register(moneyOutRoutes);
};
