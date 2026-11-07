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

const get = (path: string, token: string) =>
  app.inject({ method: 'GET', url: `/api/v1${path}`, headers: headers(token) });

/** A paid 960 ETB dine-in bill (2 Tibs + 1 Coffee), in cash. */
async function paidBill(table: number) {
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
  await app.inject({
    method: 'POST',
    url: `/api/v1/bills/${bill.id}/payments`,
    headers: headers(r.waiter.token, newKey()),
    payload: { method: 'cash', cashEtb: 960 },
  });
}

describe('reports', () => {
  it('a waiter gets 403', async () => {
    for (const tab of ['sales', 'food', 'expenses', 'staff']) {
      expect((await get(`/reports/${tab}`, r.waiter.token)).statusCode).toBe(403);
    }
    expect((await get('/reports/export.csv?tab=sales', r.waiter.token)).statusCode).toBe(403);
  });

  it('a manager only while the owner allows it', async () => {
    expect((await get('/reports/sales', r.manager.token)).statusCode).toBe(403);
    const put = await app.inject({
      method: 'PUT',
      url: '/api/v1/business/report-access',
      headers: headers(r.owner.token),
      payload: { managerCanSeeReports: true },
    });
    expect(put.statusCode).toBe(200);
    expect((await get('/reports/sales', r.manager.token)).statusCode).toBe(200);
    expect((await get('/business/report-access', r.manager.token)).json()).toEqual({
      managerCanSeeReports: true,
      canSeeReports: true,
    });
  });

  it('adds up sales, food and waiters; empty lists when nothing happened', async () => {
    const empty = (await get('/reports/food', r.owner.token)).json() as { bestSellers: unknown[] };
    expect(empty.bestSellers).toEqual([]);

    await paidBill(0);
    await paidBill(1);
    const sales = (await get('/reports/sales', r.owner.token)).json() as {
      total: number;
      bills: number;
      avgBill: number;
      paidBy: { cash: { amount: number; bills: number } };
      byDay: unknown[];
    };
    expect(sales).toMatchObject({ total: 1920, bills: 2, avgBill: 960 });
    expect(sales.paidBy.cash).toEqual({ amount: 1920, bills: 2 });
    expect(sales.byDay).toHaveLength(1);

    const food = (await get('/reports/food', r.owner.token)).json() as {
      bestSellers: { qty: number; amount: number }[];
    };
    expect(food.bestSellers[0]).toMatchObject({ qty: 4, amount: 1800 });

    const staff = (await get('/reports/staff', r.owner.token)).json() as {
      waiterSales: unknown[];
    };
    expect(staff.waiterSales).toEqual([
      { name: 'Waiter Dawit', sales: 1920, bills: 2, avgBill: 960 },
    ]);

    const csv = await get('/reports/export.csv?tab=sales', r.owner.token);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.body).toContain('1,920');
    const pdf = await get('/reports/export.pdf?tab=staff', r.owner.token);
    expect(pdf.body.startsWith('%PDF-1.4')).toBe(true);
  });

  it('profit and money left', async () => {
    await paidBill(0);
    await app.prisma.spending.createMany({
      data: [
        { title: 'Rent', amount: 300, category: 'RENT' as const, paidFrom: 'CASH' as const },
        { title: 'Lunch', amount: 100, category: 'OTHER' as const, paidFrom: 'CASH' as const },
      ].map((s) => ({ ...s, businessId: r.businessId, createdById: r.owner.memberId })),
    });
    const body = (await get('/reports/expenses', r.owner.token)).json();
    expect(body).toMatchObject({ total: 400, sales: 960, profit: 660, moneyLeft: 560 });
  });
});
