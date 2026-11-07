import type { PrismaClient, SpendingCategory } from '../../generated/prisma/client.js';

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
/** Africa/Addis_Ababa is UTC+3 all year. */
const ADDIS_MS = 3 * HOUR_MS;

export const addisDay = (d: Date) => new Date(d.getTime() + ADDIS_MS).toISOString().slice(0, 10);
const addisHour = (d: Date) => new Date(d.getTime() + ADDIS_MS).getUTCHours();

export interface Range {
  /** First day (YYYY-MM-DD, Addis Ababa). */
  from: string;
  /** Last day, included. */
  to: string;
  gte: Date;
  lt: Date;
}

/** Days `from`..`to` (Addis Ababa calendar days, `to` included). Default: today. */
export function reportRange(from?: string, to?: string, now = new Date()): Range {
  const first = from ?? to ?? addisDay(now);
  const last = to ?? first;
  const [a, b] = first <= last ? [first, last] : [last, first];
  const gte = new Date(Date.parse(`${a}T00:00:00Z`) - ADDIS_MS);
  const lt = new Date(Date.parse(`${b}T00:00:00Z`) - ADDIS_MS + DAY_MS);
  return { from: a, to: b, gte, lt };
}

/** The same number of days just before. */
const previousOf = (r: Range) => {
  const span = r.lt.getTime() - r.gte.getTime();
  return { gte: new Date(r.gte.getTime() - span), lt: r.gte };
};

/** Adds to a keyed tally, creating the entry the first time. */
function tally<T>(map: Map<string, T>, key: string, start: () => T, add: (entry: T) => void) {
  let entry = map.get(key);
  if (!entry) {
    entry = start();
    map.set(key, entry);
  }
  add(entry);
}

const member = { select: { user: { select: { name: true } } } } as const;
const byAmount = <T extends { amount: number }>(a: T, b: T) => b.amount - a.amount;
const range = (r: Range) => ({ gte: r.gte, lt: r.lt });

/** Sales = bill totals of the bills paid in the range (tips are the waiters', not sales). */
async function salesTotal(prisma: PrismaClient, businessId: string, r: { gte: Date; lt: Date }) {
  const sum = await prisma.bill.aggregate({
    where: { businessId, payment: { is: { createdAt: r } } },
    _sum: { totalEtb: true },
  });
  return sum._sum.totalEtb ?? 0;
}

export async function salesReport(prisma: PrismaClient, businessId: string, r: Range) {
  const [payments, previousTotal] = await Promise.all([
    prisma.payment.findMany({
      where: { businessId, createdAt: range(r) },
      select: { createdAt: true, method: true, bill: { select: { totalEtb: true } } },
    }),
    salesTotal(prisma, businessId, previousOf(r)),
  ]);
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, amount: 0, bills: 0 }));
  const days = new Map<string, { date: string; amount: number; bills: number }>();
  for (let t = r.gte.getTime(); t < r.lt.getTime(); t += DAY_MS) {
    const date = addisDay(new Date(t));
    days.set(date, { date, amount: 0, bills: 0 });
  }
  const paidBy = {
    cash: { amount: 0, bills: 0 },
    bank: { amount: 0, bills: 0 },
    both: { amount: 0, bills: 0 },
  };
  let total = 0;
  for (const p of payments) {
    const amount = p.bill.totalEtb;
    total += amount;
    for (const e of [
      byHour[addisHour(p.createdAt)],
      days.get(addisDay(p.createdAt)),
      paidBy[p.method === 'cash_bank' ? 'both' : p.method],
    ]) {
      if (e) {
        e.amount += amount;
        e.bills += 1;
      }
    }
  }
  return {
    from: r.from,
    to: r.to,
    total,
    bills: payments.length,
    avgBill: payments.length ? Math.round(total / payments.length) : 0,
    previousTotal,
    paidBy,
    byHour,
    byDay: [...days.values()],
  };
}

export async function foodReport(prisma: PrismaClient, businessId: string, r: Range) {
  const [orderItems, menuItems, cancelledOrders] = await Promise.all([
    prisma.orderItem.findMany({
      where: { order: { businessId, cancelledAt: null, createdAt: range(r) } },
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
      where: { businessId, cancelledAt: range(r) },
      orderBy: { cancelledAt: 'desc' },
      select: {
        id: true,
        number: true,
        cancelReason: true,
        foodTotalEtb: true,
        waiter: member,
        items: { select: { name: true, quantity: true } },
      },
    }),
  ]);

  type Line = { name: string; nameAm: string | null; qty: number; amount: number };
  const menuById = new Map(menuItems.map((m) => [m.id, m]));
  const items = new Map<string, Line>();
  const categories = new Map<string, Line>();
  for (const it of orderItems) {
    const menu = it.menuItemId ? menuById.get(it.menuItemId) : undefined;
    const add = (e: Line) => {
      e.qty += it.quantity;
      e.amount += it.priceEtb * it.quantity;
    };
    tally(
      items,
      it.menuItemId ?? `name:${it.name.toLowerCase()}`,
      () => ({ name: menu?.name ?? it.name, nameAm: menu?.nameAm ?? null, qty: 0, amount: 0 }),
      add
    );
    const cat = menu?.itemCategory;
    tally(
      categories,
      cat?.name ?? '',
      () => ({ name: cat?.name ?? '', nameAm: cat?.nameAm ?? null, qty: 0, amount: 0 }),
      add
    );
  }
  const slowSellers = menuItems
    .filter((m) => m.active)
    .map((m) => ({
      name: m.name,
      nameAm: m.nameAm,
      qty: items.get(m.id)?.qty ?? 0,
      amount: items.get(m.id)?.amount ?? 0,
    }))
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
  return {
    from: r.from,
    to: r.to,
    bestSellers: [...items.values()]
      .sort((a, b) => b.qty - a.qty || b.amount - a.amount)
      .slice(0, 15),
    byCategory: [...categories.values()].sort(byAmount),
    slowSellers,
    cancelled: {
      count: cancelledOrders.length,
      amount: cancelledOrders.reduce((s, o) => s + o.foodTotalEtb, 0),
      topItems: [...cancelledItems.values()].sort((a, b) => b.qty - a.qty).slice(0, 5),
      orders: cancelledOrders.slice(0, 30).map((o) => ({
        id: o.id,
        number: o.number,
        amount: o.foodTotalEtb,
        waiter: o.waiter.user.name,
        reason: o.cancelReason,
      })),
    },
  };
}

export async function expensesReport(prisma: PrismaClient, businessId: string, r: Range) {
  const [business, spendings, changedByOwner, deleted, bought, sales] = await Promise.all([
    prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { costKinds: true } }),
    prisma.spending.findMany({
      where: { businessId, deletedAt: null, createdAt: range(r) },
      select: {
        amount: true,
        category: true,
        paidFrom: true,
        hasReceipt: true,
        forBusiness: true,
        buyItemId: true,
        createdById: true,
        createdBy: member,
      },
    }),
    prisma.spending.count({ where: { businessId, deletedAt: null, changedAt: range(r) } }),
    prisma.spending.findMany({
      where: { businessId, deletedAt: range(r) },
      orderBy: { deletedAt: 'desc' },
      select: { title: true, amount: true, deleteReason: true },
    }),
    prisma.buyItem.findMany({
      where: { businessId, status: 'BOUGHT', boughtAt: range(r) },
      select: { name: true, price: true },
    }),
    salesTotal(prisma, businessId, range(r)),
  ]);
  const costKinds = new Set<SpendingCategory>(business.costKinds);
  const kinds = new Map<SpendingCategory, { amount: number; count: number }>();
  const people = new Map<
    string,
    { name: string; total: number; count: number; cash: number; bank: number }
  >();
  let total = 0;
  let costs = 0;
  for (const s of spendings) {
    total += s.amount;
    // Purchases (from the buy list) and the business costs the owner counts.
    const cost =
      s.buyItemId !== null || (s.hasReceipt && s.forBusiness && costKinds.has(s.category));
    if (cost) costs += s.amount;
    tally(
      kinds,
      s.category,
      () => ({ amount: 0, count: 0 }),
      (k) => {
        k.amount += s.amount;
        k.count += 1;
      }
    );
    tally(
      people,
      s.createdById,
      () => ({ name: s.createdBy.user.name, total: 0, count: 0, cash: 0, bank: 0 }),
      (p) => {
        p.total += s.amount;
        p.count += 1;
        if (s.paidFrom === 'CASH') p.cash += s.amount;
        else p.bank += s.amount;
      }
    );
  }
  const boughtItems = new Map<string, { name: string; times: number; amount: number }>();
  for (const b of bought) {
    tally(
      boughtItems,
      b.name.trim().toLowerCase(),
      () => ({ name: b.name.trim(), times: 0, amount: 0 }),
      (e) => {
        e.times += 1;
        e.amount += b.price ?? 0;
      }
    );
  }
  return {
    from: r.from,
    to: r.to,
    total,
    sales,
    profit: sales - costs,
    moneyLeft: sales - total,
    byKind: [...kinds.entries()].map(([kind, k]) => ({ kind, ...k })).sort(byAmount),
    boughtItems: [...boughtItems.values()].sort(byAmount),
    byPerson: [...people.values()].sort((a, b) => b.total - a.total),
    changedByOwner,
    deleted: deleted.map((d) => ({ title: d.title, amount: d.amount, reason: d.deleteReason })),
  };
}

export async function staffReport(prisma: PrismaClient, businessId: string, r: Range) {
  const [payments, tips, transactions, receiptChecks, kitchen] = await Promise.all([
    prisma.payment.findMany({
      where: { businessId, createdAt: range(r) },
      select: { bill: { select: { totalEtb: true, waiterId: true, waiter: member } } },
    }),
    prisma.tip.findMany({
      where: { businessId, createdAt: range(r) },
      select: { amountEtb: true, paidOut: true, waiterId: true, waiter: member },
    }),
    prisma.transaction.findMany({
      where: { businessId, createdAt: range(r), status: { not: 'pending' } },
      select: { status: true, bankCode: true, memberId: true, member },
    }),
    prisma.receiptCheck.findMany({
      where: { businessId, createdAt: range(r) },
      select: { bankCode: true, checkedById: true, checkedBy: member },
    }),
    prisma.kitchenOrder.findMany({
      where: { businessId, createdAt: range(r), readyAt: { not: null } },
      select: {
        createdAt: true,
        readyAt: true,
        order: { select: { items: { select: { name: true } } } },
      },
    }),
  ]);

  const waiters = new Map<string, { name: string; sales: number; bills: number }>();
  for (const p of payments) {
    tally(
      waiters,
      p.bill.waiterId,
      () => ({ name: p.bill.waiter.user.name, sales: 0, bills: 0 }),
      (w) => {
        w.sales += p.bill.totalEtb;
        w.bills += 1;
      }
    );
  }
  const tipMap = new Map<string, { name: string; total: number; paidOut: number }>();
  for (const t of tips) {
    tally(
      tipMap,
      t.waiterId,
      () => ({ name: t.waiter.user.name, total: 0, paidOut: 0 }),
      (e) => {
        e.total += t.amountEtb;
        if (t.paidOut) e.paidOut += t.amountEtb;
      }
    );
  }
  const banks = new Map<string, { bank: string; ok: number; failed: number }>();
  const checkers = new Map<string, { name: string; ok: number; failed: number }>();
  const check = (bank: string, id: string, name: string, ok: boolean) => {
    const add = (e: { ok: number; failed: number }) => {
      if (ok) e.ok += 1;
      else e.failed += 1;
    };
    tally(banks, bank, () => ({ bank, ok: 0, failed: 0 }), add);
    tally(checkers, id, () => ({ name, ok: 0, failed: 0 }), add);
  };
  for (const t of transactions) {
    check(t.bankCode, t.memberId, t.member.user.name, t.status === 'verified');
  }
  for (const c of receiptChecks) check(c.bankCode, c.checkedById, c.checkedBy.user.name, false);
  const byChecks = (a: { ok: number; failed: number }, b: { ok: number; failed: number }) =>
    b.ok + b.failed - (a.ok + a.failed);

  const dishes = new Map<string, { name: string; orders: number; minutes: number }>();
  let kitchenMinutes = 0;
  for (const k of kitchen) {
    const minutes = ((k.readyAt ?? k.createdAt).getTime() - k.createdAt.getTime()) / 60_000;
    kitchenMinutes += minutes;
    for (const name of new Set(k.order.items.map((i) => i.name))) {
      tally(
        dishes,
        name.toLowerCase(),
        () => ({ name, orders: 0, minutes: 0 }),
        (d) => {
          d.orders += 1;
          d.minutes += minutes;
        }
      );
    }
  }
  const bankList = [...banks.values()].sort(byChecks);
  return {
    from: r.from,
    to: r.to,
    waiterSales: [...waiters.values()]
      .map((w) => ({ ...w, avgBill: Math.round(w.sales / w.bills) }))
      .sort((a, b) => b.sales - a.sales),
    tips: [...tipMap.values()].sort((a, b) => b.total - a.total),
    receiptChecks: {
      ok: bankList.reduce((s, b) => s + b.ok, 0),
      failed: bankList.reduce((s, b) => s + b.failed, 0),
      byBank: bankList,
      byStaff: [...checkers.values()].sort(byChecks),
    },
    kitchen: {
      avgMinutes: kitchen.length ? Math.round(kitchenMinutes / kitchen.length) : 0,
      orders: kitchen.length,
      slowest: [...dishes.values()]
        .map((d) => ({ name: d.name, minutes: Math.round(d.minutes / d.orders), orders: d.orders }))
        .sort((a, b) => b.minutes - a.minutes)
        .slice(0, 10),
    },
  };
}

export type SalesReport = Awaited<ReturnType<typeof salesReport>>;
export type FoodReport = Awaited<ReturnType<typeof foodReport>>;
export type ExpensesReport = Awaited<ReturnType<typeof expensesReport>>;
export type StaffReport = Awaited<ReturnType<typeof staffReport>>;
