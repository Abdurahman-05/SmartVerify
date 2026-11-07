import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import type { AuthContext } from '../../plugins/auth.js';
import { requireRestaurantPlan, requireRoles } from '../../plugins/auth.js';
import { AppError } from '../../shared/errors/app-error.js';
import { errorResponseSchema } from '../../shared/schemas/common.js';
import { daySchema } from '../../shared/utils/period.js';
import { tableOf, toCsv, toPdf, type Tab } from './reports.export.js';
import {
  expensesReport,
  foodReport,
  reportRange,
  salesReport,
  staffReport,
} from './reports.service.js';

const int = z.number().int();
const nameAm = z.string().nullable();
const span = { from: z.string(), to: z.string() };
const qtyLine = z.object({ name: z.string(), nameAm, qty: int, amount: int });
const okFailed = { ok: int, failed: int };

const salesSchema = z.object({
  ...span,
  total: int.describe('Bill totals of the bills paid in the range (tips not included)'),
  bills: int,
  avgBill: int,
  previousTotal: int.describe('The same number of days just before'),
  paidBy: z.object({
    cash: z.object({ amount: int, bills: int }),
    bank: z.object({ amount: int, bills: int }),
    both: z.object({ amount: int, bills: int }),
  }),
  byHour: z.array(z.object({ hour: int, amount: int, bills: int })),
  byDay: z.array(z.object({ date: z.string(), amount: int, bills: int })),
});

const foodSchema = z.object({
  ...span,
  bestSellers: z.array(qtyLine).describe('Top 15 by quantity'),
  byCategory: z.array(qtyLine),
  slowSellers: z.array(qtyLine).describe('Active menu items that sold least (0 = never)'),
  cancelled: z.object({
    count: int,
    amount: int,
    topItems: z.array(z.object({ name: z.string(), qty: int })),
    orders: z.array(
      z.object({
        id: z.string(),
        number: int,
        amount: int,
        waiter: z.string(),
        reason: z.string().nullable(),
      })
    ),
  }),
});

const expensesSchema = z.object({
  ...span,
  total: int,
  sales: int,
  profit: int.describe('Sales minus purchases (buy list) and the business costs the owner counts'),
  moneyLeft: int.describe('Sales minus all expenses'),
  byKind: z.array(
    z.object({
      kind: z.enum([
        'FOOD',
        'DRINKS',
        'GAS',
        'RENT',
        'SALARY',
        'REPAIRS',
        'TRANSPORT',
        'BILLS',
        'OTHER',
      ]),
      amount: int,
      count: int,
    })
  ),
  boughtItems: z.array(z.object({ name: z.string(), times: int, amount: int })),
  byPerson: z.array(z.object({ name: z.string(), total: int, count: int, cash: int, bank: int })),
  changedByOwner: int,
  deleted: z.array(z.object({ title: z.string(), amount: int, reason: z.string().nullable() })),
});

const staffSchema = z.object({
  ...span,
  waiterSales: z.array(z.object({ name: z.string(), sales: int, bills: int, avgBill: int })),
  tips: z.array(z.object({ name: z.string(), total: int, paidOut: int })),
  receiptChecks: z.object({
    ...okFailed,
    byBank: z.array(z.object({ bank: z.string(), ...okFailed })),
    byStaff: z.array(z.object({ name: z.string(), ...okFailed })),
  }),
  kitchen: z.object({
    avgMinutes: int,
    orders: int,
    slowest: z.array(z.object({ name: z.string(), minutes: int, orders: int })),
  }),
});

const rangeQuery = z.object({
  from: daySchema.optional().describe('First day, YYYY-MM-DD (Addis Ababa). Default: today'),
  to: daySchema.optional().describe('Last day, included. Default: same as from'),
});
const errors = {
  401: errorResponseSchema.describe('UNAUTHORIZED'),
  402: errorResponseSchema.describe('SUBSCRIPTION_REQUIRED (restaurant plan only)'),
  403: errorResponseSchema.describe('FORBIDDEN (waiters, chefs, or a manager not allowed)'),
};
const accessSchema = z.object({
  managerCanSeeReports: z.boolean(),
  canSeeReports: z.boolean().describe('Whether the caller may open Reports'),
});

const builders = {
  sales: salesReport,
  food: foodReport,
  expenses: expensesReport,
  staff: staffReport,
} as const;

/**
 * Restaurant reports (read only). The owner sees everything; a manager only while the owner's
 * `managerCanSeeReports` switch is on; waiters and chefs never.
 */
export const reportRoutes: FastifyPluginAsyncZod = async (app) => {
  const { prisma } = app;
  const security = [{ bearerAuth: [] }];

  const mayView = async (auth: AuthContext) => {
    if (auth.role === 'owner') return true;
    if (auth.role !== 'manager') return false;
    const business = await prisma.business.findUniqueOrThrow({
      where: { id: auth.businessId },
      select: { managerCanSeeReports: true },
    });
    return business.managerCanSeeReports;
  };
  const guard = async (auth: AuthContext) => {
    if (!(await mayView(auth))) throw new AppError('FORBIDDEN');
  };
  const preHandler = [requireRoles('owner', 'manager'), requireRestaurantPlan];
  const tabRoute = (tab: Tab, schema: z.ZodType, description: string) =>
    app.get(
      `/reports/${tab}`,
      {
        preHandler,
        schema: {
          tags: ['reports'],
          security,
          description,
          querystring: rangeQuery,
          response: { 200: schema, ...errors },
        },
      },
      async (request) => {
        await guard(request.auth);
        const { from, to } = request.query;
        return builders[tab](prisma, request.auth.businessId, reportRange(from, to));
      }
    );

  tabRoute('sales', salesSchema, 'Sales: totals, how customers paid, by hour and by day.');
  tabRoute('food', foodSchema, 'Food and drink: best and slow sellers, categories, cancelled.');
  tabRoute(
    'expenses',
    expensesSchema,
    'Expenses by kind, bought items, by person, owner changes and deletions; profit and money left.'
  );
  tabRoute('staff', staffSchema, 'Waiter sales, tips, receipt checks and kitchen speed.');

  for (const format of ['csv', 'pdf'] as const) {
    app.get(
      `/reports/export.${format}`,
      {
        preHandler,
        schema: {
          tags: ['reports'],
          security,
          description: `The same numbers as one tab, as a ${format.toUpperCase()} file.`,
          querystring: rangeQuery.extend({ tab: z.enum(['sales', 'food', 'expenses', 'staff']) }),
          response: { 200: z.any().describe('The file'), ...errors },
        },
      },
      async (request, reply) => {
        await guard(request.auth);
        const { tab, from, to } = request.query;
        const r = reportRange(from, to);
        const business = await prisma.business.findUniqueOrThrow({
          where: { id: request.auth.businessId },
          select: { name: true },
        });
        const table = tableOf(tab, await builders[tab](prisma, request.auth.businessId, r));
        const days = r.from === r.to ? r.from : `${r.from} to ${r.to}`;
        const file = `report-${tab}-${r.from}${r.from === r.to ? '' : `-${r.to}`}.${format}`;
        reply.header('content-disposition', `attachment; filename="${file}"`);
        if (format === 'csv') {
          return reply
            .type('text/csv; charset=utf-8')
            .send(toCsv(table, `${business.name} - ${days}`));
        }
        return reply.type('application/pdf').send(toPdf(table, `${business.name} - ${days}`));
      }
    );
  }

  // ─── The owner's switch ────────────────────────────────────────────────────

  app.get(
    '/business/report-access',
    {
      schema: {
        tags: ['reports'],
        security,
        description: 'Any member: whether managers may see Reports, and whether the caller may.',
        response: { 200: accessSchema, 401: errors[401] },
      },
    },
    async (request) => {
      const business = await prisma.business.findUniqueOrThrow({
        where: { id: request.auth.businessId },
        select: { managerCanSeeReports: true, plan: true },
      });
      return {
        managerCanSeeReports: business.managerCanSeeReports,
        canSeeReports: business.plan === 'restaurant' && (await mayView(request.auth)),
      };
    }
  );

  app.put(
    '/business/report-access',
    {
      preHandler: [requireRoles('owner'), requireRestaurantPlan],
      schema: {
        tags: ['reports'],
        security,
        description: 'Owner only: let managers open Reports, or not.',
        body: z.object({ managerCanSeeReports: z.boolean() }),
        response: { 200: accessSchema, ...errors },
      },
    },
    async (request) => {
      const { managerCanSeeReports } = request.body;
      await prisma.business.update({
        where: { id: request.auth.businessId },
        data: { managerCanSeeReports },
      });
      return { managerCanSeeReports, canSeeReports: true };
    }
  );
};
