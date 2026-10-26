import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import type { Prisma } from '../../generated/prisma/client.js';
import { requireRestaurantPlan, requireRoles } from '../../plugins/auth.js';
import { AppError } from '../../shared/errors/app-error.js';
import { errorResponseSchema, idParamSchema } from '../../shared/schemas/common.js';
import { periodStart } from '../../shared/utils/period.js';

const whenSchema = z.enum(['TODAY', 'WEEK']);
const statusSchema = z.enum(['OPEN', 'BOUGHT']);
const paidFromSchema = z.enum(['CASH', 'BANK']);
const categorySchema = z.enum(['FOOD', 'TRANSPORT', 'BILLS', 'OTHER']);
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
  createdBy: { select: { user: { select: { name: true } } } },
} satisfies Prisma.SpendingInclude;

const toSpending = (row: Prisma.SpendingGetPayload<{ include: typeof spendingInclude }>) => ({
  id: row.id,
  title: row.title,
  amount: row.amount,
  category: row.category,
  paidFrom: row.paidFrom,
  buyItemId: row.buyItemId,
  createdBy: row.createdBy.user.name,
  createdAt: row.createdAt.toISOString(),
});

/**
 * Owner extras (Restaurant Plus): the kitchen buy list and money out. The owner switches each on
 * or off; off only hides it (403 on its routes), nothing is ever deleted.
 */
export const extrasRoutes: FastifyPluginAsyncZod = async (app) => {
  const { prisma } = app;
  const security = [{ bearerAuth: [] }];

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
        return prisma.$transaction(async (tx) => {
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
            await tx.spending.create({
              data: {
                businessId: auth.businessId,
                title: row.qty ? `${row.name} (${row.qty})` : row.name,
                amount: body.price,
                category: 'FOOD',
                paidFrom: body.paidFrom,
                buyItemId: row.id,
                createdById: auth.memberId,
              },
            });
          }
          return toBuyItem(row);
        });
      }
    );
  };
  await app.register(buyListRoutes);

  // ─── Money out ─────────────────────────────────────────────────────────────

  const moneyOutRoutes: FastifyPluginAsyncZod = async (money) => {
    money.addHook('preHandler', requireRestaurantPlan);
    money.addHook('preHandler', needs('featureMoneyOut'));

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
        return reply.status(201).send(toSpending(row));
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
            }),
            400: errorResponseSchema,
            ...errors,
          },
        },
      },
      async (request) => {
        const { businessId } = request.auth;
        const from = request.query.from ? new Date(request.query.from) : periodStart('today');
        const to = request.query.to ? new Date(request.query.to) : undefined;
        const range = { gte: from, ...(to && { lte: to }) };
        const sum = async (where: Prisma.SpendingWhereInput) =>
          (
            await prisma.spending.aggregate({
              where: { businessId, ...where },
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
        return { entries: rows.map(toSpending), totals: { today, week, cash, bank } };
      }
    );
  };
  await app.register(moneyOutRoutes);
};
