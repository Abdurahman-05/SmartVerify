import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { requireRestaurantPlan, requireRoles } from '../../plugins/auth.js';
import { AppError } from '../../shared/errors/app-error.js';
import { errorResponseSchema } from '../../shared/schemas/common.js';
import { dayRange, daySchema, periodSchema, periodStart } from '../../shared/utils/period.js';

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
/** Addis Ababa is UTC+3 all year. */
const ADDIS_MS = 3 * HOUR_MS;
const addisDay = (d: Date) => new Date(d.getTime() + ADDIS_MS).toISOString().slice(0, 10);
const addisHour = (d: Date) => new Date(d.getTime() + ADDIS_MS).getUTCHours();

const int = z.number().int();
const methodSchema = z.enum(['cash', 'bank', 'cash+bank']);
const kindSchema = z.enum([
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
const nameAm = z.string().nullable();

const reportSchema = z.object({
  from: z.string().describe('Start of the period (ISO)'),
  to: z.string().describe('End of the period, exclusive (ISO)'),
  sales: z.object({
    totalEtb: int.describe('Bill totals of bills paid in the period (tips not included)'),
    bills: int,
    averageEtb: int,
    previousEtb: int.describe('Same length of time just before, for comparison'),
    byHour: z.array(z.object({ hour: int, totalEtb: int, bills: int })),
    byDay: z.array(z.object({ day: z.string(), totalEtb: int, bills: int })),
    methods: z.array(z.object({ method: methodSchema, bills: int, totalEtb: int })),
  }),
  menu: z.object({
    items: z.array(
      z.object({
        name: z.string(),
        nameAm,
        category: z.string().nullable(),
        qty: int,
        totalEtb: int,
      })
    ),
    slow: z.array(z.object({ name: z.string(), nameAm, qty: int })),
    categories: z.array(z.object({ name: z.string(), nameAm, qty: int, totalEtb: int })),
    cancelled: z.object({
      orders: int,
      totalEtb: int,
      items: z.array(z.object({ name: z.string(), qty: int })),
      list: z.array(
        z.object({
          number: int,
          reason: z.string().nullable(),
          by: z.string().nullable(),
          totalEtb: int,
          at: z.string(),
        })
      ),
    }),
  }),
  expenses: z.object({
    totalEtb: int,
    byKind: z.array(z.object({ kind: kindSchema, totalEtb: int, count: int })),
    bought: z.array(z.object({ name: z.string(), times: int, totalEtb: int })),
    byPerson: z.array(
      z.object({ name: z.string(), count: int, cashEtb: int, bankEtb: int, totalEtb: int })
    ),
    changed: int,
    deleted: z.array(
      z.object({ title: z.string(), amountEtb: int, reason: z.string().nullable() })
    ),
  }),
  staff: z.object({
    waiters: z.array(z.object({ name: z.string(), bills: int, salesEtb: int, averageEtb: int })),
    tips: z.array(z.object({ name: z.string(), count: int, totalEtb: int, paidOutEtb: int })),
    checks: z.object({
      ok: int,
      bad: int,
      byBank: z.array(z.object({ bank: z.string(), ok: int, bad: int })),
      byPerson: z.array(z.object({ name: z.string(), ok: int, bad: int })),
    }),
    kitchen: z.object({
      orders: int,
      averageMinutes: int,
      slowest: z.array(z.object({ name: z.string(), orders: int, averageMinutes: int })),
    }),
  }),
});

/** Adds to a keyed tally, creating the entry the first time. */
function tally<T>(map: Map<string, T>, key: string, start: () => T, add: (entry: T) => void) {
  let entry = map.get(key);
  if (!entry) {
    entry = start();
    map.set(key, entry);
  }
  add(entry);
}

export const reportRoutes: FastifyPluginAsyncZod = async (app) => {
  const { prisma } = app;

  app.get(
    '/reports/restaurant',
    {
      preHandler: [requireRoles('owner', 'manager'), requireRestaurantPlan],
      schema: {
        tags: ['reports'],
        security: [{ bearerAuth: [] }],
        description:
          'Owner (or a manager allowed to see reports): every restaurant report for the period ' +
          'or one `date` (YYYY-MM-DD): sales, food and drink, expenses and buying, staff and ' +
          'receipt checks. All sums are made here; the app only shows them.',
        querystring: z.object({ period: periodSchema, date: daySchema.optional() }),
        response: {
          200: reportSchema,
          401: errorResponseSchema.describe('UNAUTHORIZED'),
          402: errorResponseSchema.describe('SUBSCRIPTION_REQUIRED (restaurant plan only)'),
          403: errorResponseSchema.describe('FORBIDDEN'),
        },
      },
    },
    async (request) => {
      const { auth } = request;
      if (auth.role === 'manager' && !auth.canSeeReports) throw new AppError('FORBIDDEN');
      const { businessId } = auth;
      const { period, date } = request.query;
      const range = date ? dayRange(date) : { gte: periodStart(period), lt: new Date() };
      const span = range.lt.getTime() - range.gte.getTime();
      const previous = { gte: new Date(range.gte.getTime() - span), lt: range.gte };
      const member = { select: { user: { select: { name: true } } } } as const;

      const [
        payments,
        prevSales,
        orderItems,
        menuItems,
        cancelledOrders,
        spendings,
        changed,
        deleted,
        bought,
        tips,
        transactions,
        receiptChecks,
        kitchen,
      ] = await Promise.all([
        prisma.payment.findMany({
          where: { businessId, createdAt: range },
          select: {
            createdAt: true,
            method: true,
            bill: { select: { totalEtb: true, waiterId: true, waiter: member } },
          },
        }),
        prisma.bill.aggregate({
          where: { businessId, payment: { is: { createdAt: previous } } },
          _sum: { totalEtb: true },
        }),
        prisma.orderItem.findMany({
          where: { order: { businessId, cancelledAt: null, createdAt: range } },
          select: { menuItemId: true, name: true, priceEtb: true, quantity: true },
        }),
        prisma.menuItem.findMany({
          where: { businessId, deletedAt: null },
          select: {
            id: true,
            name: true,
            nameAm: true,
            active: true,
            itemCategory: { select: { name: true, nameAm: true } },
          },
        }),
        prisma.order.findMany({
          where: { businessId, cancelledAt: range },
          orderBy: { cancelledAt: 'desc' },
          select: {
            number: true,
            cancelReason: true,
            cancelledAt: true,
            foodTotalEtb: true,
            cancelledBy: member,
            items: { select: { name: true, quantity: true } },
          },
        }),
        prisma.spending.findMany({
          where: { businessId, deletedAt: null, createdAt: range },
          select: {
            amount: true,
            category: true,
            paidFrom: true,
            createdById: true,
            createdBy: member,
          },
        }),
        prisma.spending.count({ where: { businessId, deletedAt: null, changedAt: range } }),
        prisma.spending.findMany({
          where: { businessId, deletedAt: range },
          orderBy: { deletedAt: 'desc' },
          select: { title: true, amount: true, deleteReason: true },
        }),
        prisma.buyItem.findMany({
          where: { businessId, status: 'BOUGHT', boughtAt: range },
          select: { name: true, price: true },
        }),
        prisma.tip.findMany({
          where: { businessId, createdAt: range },
          select: { amountEtb: true, paidOut: true, waiterId: true, waiter: member },
        }),
        prisma.transaction.findMany({
          where: { businessId, createdAt: range, status: { not: 'pending' } },
          select: { status: true, bankCode: true, memberId: true, member },
        }),
        prisma.receiptCheck.findMany({
          where: { businessId, createdAt: range },
          select: { bankCode: true, checkedById: true, checkedBy: member },
        }),
        prisma.kitchenOrder.findMany({
          where: { businessId, createdAt: range, readyAt: { not: null } },
          select: {
            createdAt: true,
            readyAt: true,
            order: { select: { items: { select: { name: true } } } },
          },
        }),
      ]);

      // ── Sales ──
      const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, totalEtb: 0, bills: 0 }));
      const days = new Map<string, { day: string; totalEtb: number; bills: number }>();
      for (let t = range.gte.getTime(); t < range.lt.getTime(); t += DAY_MS) {
        const day = addisDay(new Date(t));
        days.set(day, { day, totalEtb: 0, bills: 0 });
      }
      const methods = new Map<string, { bills: number; totalEtb: number }>();
      const waiters = new Map<string, { name: string; bills: number; salesEtb: number }>();
      let salesTotal = 0;
      for (const p of payments) {
        const amount = p.bill.totalEtb;
        salesTotal += amount;
        const h = byHour[addisHour(p.createdAt)];
        if (h) {
          h.totalEtb += amount;
          h.bills += 1;
        }
        const d = days.get(addisDay(p.createdAt));
        if (d) {
          d.totalEtb += amount;
          d.bills += 1;
        }
        const method = p.method === 'cash_bank' ? 'cash+bank' : p.method;
        tally(
          methods,
          method,
          () => ({ bills: 0, totalEtb: 0 }),
          (m) => {
            m.bills += 1;
            m.totalEtb += amount;
          }
        );
        tally(
          waiters,
          p.bill.waiterId,
          () => ({ name: p.bill.waiter.user.name, bills: 0, salesEtb: 0 }),
          (w) => {
            w.bills += 1;
            w.salesEtb += amount;
          }
        );
      }

      // ── Food and drink ──
      const menuById = new Map(menuItems.map((m) => [m.id, m]));
      const items = new Map<
        string,
        {
          name: string;
          nameAm: string | null;
          category: string | null;
          qty: number;
          totalEtb: number;
        }
      >();
      const categories = new Map<
        string,
        { name: string; nameAm: string | null; qty: number; totalEtb: number }
      >();
      const soldQty = new Map<string, number>();
      for (const it of orderItems) {
        const menu = it.menuItemId ? menuById.get(it.menuItemId) : undefined;
        const money = it.priceEtb * it.quantity;
        if (it.menuItemId)
          soldQty.set(it.menuItemId, (soldQty.get(it.menuItemId) ?? 0) + it.quantity);
        tally(
          items,
          it.menuItemId ?? `name:${it.name.toLowerCase()}`,
          () => ({
            name: menu?.name ?? it.name,
            nameAm: menu?.nameAm ?? null,
            category: menu?.itemCategory.name ?? null,
            qty: 0,
            totalEtb: 0,
          }),
          (e) => {
            e.qty += it.quantity;
            e.totalEtb += money;
          }
        );
        const cat = menu?.itemCategory;
        tally(
          categories,
          cat?.name ?? '',
          () => ({ name: cat?.name ?? '', nameAm: cat?.nameAm ?? null, qty: 0, totalEtb: 0 }),
          (c) => {
            c.qty += it.quantity;
            c.totalEtb += money;
          }
        );
      }
      const slow = menuItems
        .filter((m) => m.active)
        .map((m) => ({ name: m.name, nameAm: m.nameAm, qty: soldQty.get(m.id) ?? 0 }))
        .sort((a, b) => a.qty - b.qty || a.name.localeCompare(b.name))
        .slice(0, 15);
      const cancelledItems = new Map<string, { name: string; qty: number }>();
      for (const o of cancelledOrders) {
        for (const it of o.items) {
          tally(
            cancelledItems,
            it.name.toLowerCase(),
            () => ({ name: it.name, qty: 0 }),
            (c) => {
              c.qty += it.quantity;
            }
          );
        }
      }

      // ── Expenses and buying ──
      const kinds = new Map<string, { totalEtb: number; count: number }>();
      const people = new Map<
        string,
        { name: string; count: number; cashEtb: number; bankEtb: number; totalEtb: number }
      >();
      let expensesTotal = 0;
      for (const s of spendings) {
        expensesTotal += s.amount;
        tally(
          kinds,
          s.category,
          () => ({ totalEtb: 0, count: 0 }),
          (k) => {
            k.totalEtb += s.amount;
            k.count += 1;
          }
        );
        tally(
          people,
          s.createdById,
          () => ({ name: s.createdBy.user.name, count: 0, cashEtb: 0, bankEtb: 0, totalEtb: 0 }),
          (p) => {
            p.count += 1;
            p.totalEtb += s.amount;
            if (s.paidFrom === 'CASH') p.cashEtb += s.amount;
            else p.bankEtb += s.amount;
          }
        );
      }
      const boughtMap = new Map<string, { name: string; times: number; totalEtb: number }>();
      for (const b of bought) {
        tally(
          boughtMap,
          b.name.trim().toLowerCase(),
          () => ({ name: b.name.trim(), times: 0, totalEtb: 0 }),
          (e) => {
            e.times += 1;
            e.totalEtb += b.price ?? 0;
          }
        );
      }

      // ── Staff and checks ──
      const tipMap = new Map<
        string,
        { name: string; count: number; totalEtb: number; paidOutEtb: number }
      >();
      for (const t of tips) {
        tally(
          tipMap,
          t.waiterId,
          () => ({ name: t.waiter.user.name, count: 0, totalEtb: 0, paidOutEtb: 0 }),
          (e) => {
            e.count += 1;
            e.totalEtb += t.amountEtb;
            if (t.paidOut) e.paidOutEtb += t.amountEtb;
          }
        );
      }
      const banks = new Map<string, { bank: string; ok: number; bad: number }>();
      const checkers = new Map<string, { name: string; ok: number; bad: number }>();
      const count = (bank: string, id: string, name: string, ok: boolean) => {
        const add = (e: { ok: number; bad: number }) => {
          if (ok) e.ok += 1;
          else e.bad += 1;
        };
        tally(banks, bank, () => ({ bank, ok: 0, bad: 0 }), add);
        tally(checkers, id, () => ({ name, ok: 0, bad: 0 }), add);
      };
      for (const t of transactions)
        count(t.bankCode, t.memberId, t.member.user.name, t.status === 'verified');
      for (const r of receiptChecks) count(r.bankCode, r.checkedById, r.checkedBy.user.name, false);
      let okChecks = 0;
      let badChecks = 0;
      for (const b of banks.values()) {
        okChecks += b.ok;
        badChecks += b.bad;
      }
      const cookMinutes = (k: { createdAt: Date; readyAt: Date | null }) =>
        ((k.readyAt?.getTime() ?? k.createdAt.getTime()) - k.createdAt.getTime()) / 60_000;
      const dishes = new Map<string, { name: string; orders: number; minutes: number }>();
      let kitchenMinutes = 0;
      for (const k of kitchen) {
        const m = cookMinutes(k);
        kitchenMinutes += m;
        for (const name of new Set(k.order.items.map((i) => i.name))) {
          tally(
            dishes,
            name.toLowerCase(),
            () => ({ name, orders: 0, minutes: 0 }),
            (d) => {
              d.orders += 1;
              d.minutes += m;
            }
          );
        }
      }

      const byMoney = <T extends { totalEtb: number }>(a: T, b: T) => b.totalEtb - a.totalEtb;
      return {
        from: range.gte.toISOString(),
        to: range.lt.toISOString(),
        sales: {
          totalEtb: salesTotal,
          bills: payments.length,
          averageEtb: payments.length ? Math.round(salesTotal / payments.length) : 0,
          previousEtb: prevSales._sum.totalEtb ?? 0,
          byHour,
          byDay: [...days.values()],
          methods: (['cash', 'bank', 'cash+bank'] as const).map((method) => ({
            method,
            ...(methods.get(method) ?? { bills: 0, totalEtb: 0 }),
          })),
        },
        menu: {
          items: [...items.values()].sort((a, b) => b.qty - a.qty || b.totalEtb - a.totalEtb),
          slow,
          categories: [...categories.values()].sort(byMoney),
          cancelled: {
            orders: cancelledOrders.length,
            totalEtb: cancelledOrders.reduce((s, o) => s + o.foodTotalEtb, 0),
            items: [...cancelledItems.values()].sort((a, b) => b.qty - a.qty),
            list: cancelledOrders.slice(0, 30).map((o) => ({
              number: o.number,
              reason: o.cancelReason,
              by: o.cancelledBy?.user.name ?? null,
              totalEtb: o.foodTotalEtb,
              at: (o.cancelledAt ?? new Date()).toISOString(),
            })),
          },
        },
        expenses: {
          totalEtb: expensesTotal,
          byKind: [...kinds.entries()]
            .map(([kind, k]) => ({ kind: kind as z.infer<typeof kindSchema>, ...k }))
            .sort(byMoney),
          bought: [...boughtMap.values()].sort(byMoney),
          byPerson: [...people.values()].sort(byMoney),
          changed,
          deleted: deleted.map((d) => ({
            title: d.title,
            amountEtb: d.amount,
            reason: d.deleteReason,
          })),
        },
        staff: {
          waiters: [...waiters.values()]
            .map((w) => ({ ...w, averageEtb: w.bills ? Math.round(w.salesEtb / w.bills) : 0 }))
            .sort((a, b) => b.salesEtb - a.salesEtb),
          tips: [...tipMap.values()].sort(byMoney),
          checks: {
            ok: okChecks,
            bad: badChecks,
            byBank: [...banks.values()].sort((a, b) => b.ok + b.bad - (a.ok + a.bad)),
            byPerson: [...checkers.values()].sort((a, b) => b.ok + b.bad - (a.ok + a.bad)),
          },
          kitchen: {
            orders: kitchen.length,
            averageMinutes: kitchen.length ? Math.round(kitchenMinutes / kitchen.length) : 0,
            slowest: [...dishes.values()]
              .map((d) => ({
                name: d.name,
                orders: d.orders,
                averageMinutes: Math.round(d.minutes / d.orders),
              }))
              .sort((a, b) => b.averageMinutes - a.averageMinutes)
              .slice(0, 10),
          },
        },
      };
    }
  );
};
