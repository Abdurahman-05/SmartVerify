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

type Res = { statusCode: number; json: () => unknown };
const code = (res: Res) => (res.json() as { error?: { code?: string } }).error?.code;
const get = (url: string, token: string) =>
  app.inject({ method: 'GET', url: `/api/v1${url}`, headers: headers(token) });

/** A paid 960 ETB dine-in bill (2 Tibs + 1 Coffee). */
async function paidBill(token: string, table: number, payment: object) {
  const bill = (
    await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers: headers(token, newKey()),
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
    headers: headers(token, newKey()),
    payload: payment,
  });
  return bill.id;
}

interface Payment {
  id: string;
  billId: string;
  label: string;
  method: string;
  salesEtb: number;
  cashEtb: number;
  bankEtb: number;
  tipEtb: number;
  changeEtb: number;
  waiterName: string;
  createdAt: string;
}

describe('payment history and report', () => {
  it('lists paid bills with the cash / bank split, newest first; filters by method', async () => {
    const cashBill = await paidBill(r.waiter.token, 0, {
      method: 'cash',
      cashEtb: 1000,
      extraChoice: 'giveback',
    });
    await paidBill(r.waiter2.token, 1, { method: 'cash+bank', cashEtb: 200, bankReceivedEtb: 860 });

    const all = (await get('/payments?period=today', r.owner.token)).json() as Payment[];
    expect(all).toHaveLength(2);
    expect(all[0]).toMatchObject({
      method: 'cash+bank',
      salesEtb: 960,
      cashEtb: 200,
      bankEtb: 760,
      tipEtb: 100,
    });
    expect(all[1]).toMatchObject({
      billId: cashBill,
      label: 'Table 1',
      method: 'cash',
      salesEtb: 960,
      cashEtb: 960,
      bankEtb: 0,
      changeEtb: 40,
      waiterName: 'Waiter Dawit',
    });

    const onlyCash = (
      await get('/payments?period=today&method=cash', r.manager.token)
    ).json() as Payment[];
    expect(onlyCash.map((p) => p.method)).toEqual(['cash']);

    // Waiters see only the payments of their own bills.
    const mine = (await get('/payments', r.waiter.token)).json() as Payment[];
    expect(mine.map((p) => p.billId)).toEqual([cashBill]);
    expect(code(await get('/payments', r.chef.token))).toBe('FORBIDDEN');
  });

  it('`since` returns only payments recorded after that time; `limit` caps the list', async () => {
    await paidBill(r.waiter.token, 0, { method: 'cash', cashEtb: 1000, extraChoice: 'giveback' });
    const first = (await get('/payments?period=today', r.owner.token)).json() as Payment[];
    expect(first).toHaveLength(1);
    const newest = first[0]!.createdAt;

    // Nothing new yet.
    const none = await get(`/payments?period=today&since=${newest}`, r.owner.token);
    expect(none.json()).toEqual([]);

    await new Promise((resolve) => setTimeout(resolve, 20));
    const second = await paidBill(r.waiter2.token, 1, {
      method: 'cash+bank',
      cashEtb: 200,
      bankReceivedEtb: 860,
    });
    const fresh = (
      await get(`/payments?period=today&since=${newest}`, r.owner.token)
    ).json() as Payment[];
    expect(fresh.map((p) => p.billId)).toEqual([second]);

    const capped = (await get('/payments?period=today&limit=1', r.owner.token)).json() as Payment[];
    expect(capped).toHaveLength(1);
    expect(code(await get('/payments?since=yesterday', r.owner.token))).toBe('VALIDATION_ERROR');
  });

  it('payment detail has the bill items and totals', async () => {
    await paidBill(r.waiter.token, 0, { method: 'bank', bankReceivedEtb: 960 });
    const [payment] = (await get('/payments', r.owner.token)).json() as Payment[];
    const detail = (await get(`/payments/${payment!.id}`, r.owner.token)).json();
    expect(detail).toMatchObject({
      method: 'bank',
      bankEtb: 960,
      foodTotalEtb: 960,
      packingFeeEtb: 0,
      items: [
        { name: 'Tibs', priceEtb: 450, quantity: 2 },
        { name: 'Coffee', priceEtb: 60, quantity: 1 },
      ],
    });
    expect(code(await get(`/payments/${payment!.id}`, r.waiter2.token))).toBe('NOT_FOUND');
  });

  it('report: sales by method without tips; waiters need the reports permission', async () => {
    await paidBill(r.waiter.token, 0, { method: 'cash', cashEtb: 1000 }); // tip 40
    await paidBill(r.waiter.token, 1, { method: 'bank', bankReceivedEtb: 960 });
    await paidBill(r.waiter.token, 2, { method: 'bank', bankReceivedEtb: 1060 }); // tip 100

    const report = (await get('/reports/payments?period=today', r.owner.token)).json();
    expect(report).toMatchObject({
      totalEtb: 2880,
      count: 3,
      cashEtb: 960,
      bankEtb: 1920,
      tipsEtb: 140,
      rows: [
        { method: 'cash', count: 1, totalEtb: 960, share: 33 },
        { method: 'bank', count: 2, totalEtb: 1920, share: 67 },
        { method: 'cash+bank', count: 0, totalEtb: 0, share: 0 },
      ],
    });
    expect(code(await get('/reports/payments', r.waiter.token))).toBe('FORBIDDEN');
    await app.prisma.businessMember.update({
      where: { id: r.waiter.memberId },
      data: { canSeeReports: true },
    });
    expect((await get('/reports/payments', r.waiter.token)).statusCode).toBe(200);
  });

  it('other businesses see nothing', async () => {
    await paidBill(r.waiter.token, 0, { method: 'cash', cashEtb: 960 });
    const other = await createRestaurant(app);
    expect((await get('/payments', other.owner.token)).json()).toEqual([]);
    expect(
      ((await get('/reports/payments', other.owner.token)).json() as { count: number }).count
    ).toBe(0);
  });
});
