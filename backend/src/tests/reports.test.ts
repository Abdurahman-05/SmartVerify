import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createRestaurant,
  createTestApp,
  headers,
  newKey,
  resetDatabase,
  type Restaurant,
  type TestApp,
} from './helpers.js';

let app: TestApp;
let r: Restaurant; // Tibs 450, Coffee 60

beforeAll(async () => {
  app = await createTestApp();
});
afterAll(async () => {
  await app.close();
});
beforeEach(async () => {
  await resetDatabase(app);
  r = await createRestaurant(app);
});

const get = (token: string, query = '') =>
  app.inject({ method: 'GET', url: `/api/v1/reports/restaurant${query}`, headers: headers(token) });

/** Orders 2 Tibs + 1 Coffee (960) on a table; pays it when `pay`. */
async function order(table: number, pay: boolean) {
  const bill = (
    await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers: headers(r.waiter.token, newKey()),
      payload: {
        type: 'dine',
        tableId: r.tables[table]!.id,
        items: [
          { menuItemId: r.menu.tibs.id, quantity: 2 },
          { menuItemId: r.menu.coffee.id, quantity: 1 },
        ],
      },
    })
  ).json() as { id: string };
  if (pay) {
    await app.inject({
      method: 'POST',
      url: `/api/v1/bills/${bill.id}/payments`,
      headers: headers(r.waiter.token, newKey()),
      payload: { method: 'cash', cashEtb: 960 },
    });
  }
  return bill.id;
}

interface Report {
  sales: {
    totalEtb: number;
    bills: number;
    averageEtb: number;
    byHour: { totalEtb: number }[];
    byDay: unknown[];
    methods: { method: string; bills: number; totalEtb: number }[];
  };
  menu: {
    items: { name: string; qty: number; totalEtb: number }[];
    slow: { qty: number }[];
    cancelled: { orders: number };
  };
  expenses: { totalEtb: number; byKind: { kind: string; totalEtb: number }[] };
  staff: { waiters: { name: string; bills: number; salesEtb: number }[] };
}

describe('GET /reports/restaurant', () => {
  it('adds up sales, food and drink, and waiters', async () => {
    await order(0, true);
    await order(1, true);
    const res = await get(r.owner.token);
    expect(res.statusCode).toBe(200);
    const body = res.json() as Report;
    expect(body.sales).toMatchObject({ totalEtb: 1920, bills: 2, averageEtb: 960 });
    expect(body.sales.byHour.reduce((s, h) => s + h.totalEtb, 0)).toBe(1920);
    expect(body.sales.byDay).toHaveLength(1);
    expect(body.sales.methods).toContainEqual({ method: 'cash', bills: 2, totalEtb: 1920 });
    expect(body.menu.items[0]).toMatchObject({ qty: 4, totalEtb: 1800 });
    expect(body.menu.items[1]).toMatchObject({ qty: 2, totalEtb: 120 });
    expect(body.staff.waiters).toEqual([
      { name: 'Waiter Dawit', bills: 2, salesEtb: 1920, averageEtb: 960 },
    ]);
  });

  it('counts expenses by kind', async () => {
    await app.prisma.business.update({
      where: { id: r.businessId },
      data: { featureMoneyOut: true },
    });
    await app.prisma.spending.create({
      data: {
        businessId: r.businessId,
        title: 'Gas',
        amount: 500,
        category: 'GAS',
        paidFrom: 'CASH',
        createdById: r.owner.memberId,
      },
    });
    const body = (await get(r.owner.token)).json() as Report;
    expect(body.expenses.totalEtb).toBe(500);
    expect(body.expenses.byKind).toEqual([{ kind: 'GAS', totalEtb: 500, count: 1 }]);
  });

  it('only the owner, or a manager allowed to see reports', async () => {
    expect((await get(r.waiter.token)).statusCode).toBe(403);
    expect((await get(r.manager.token)).statusCode).toBe(403);
    await app.prisma.businessMember.update({
      where: { id: r.manager.memberId },
      data: { canSeeReports: true },
    });
    expect((await get(r.manager.token)).statusCode).toBe(200);
  });

  it('one chosen day', async () => {
    await order(0, true);
    const body = (await get(r.owner.token, '?date=2020-01-01')).json() as Report;
    expect(body.sales.totalEtb).toBe(0);
    expect(body.sales.byDay).toHaveLength(1);
  });
});
