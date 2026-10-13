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
interface Result {
  status: string;
  totalEtb: number;
  cashEtb: number;
  bankReceivedEtb: number;
  expectedBankEtb: number;
  remainingEtb: number;
  tipEtb: number;
  changeEtb: number;
}

/** A dine-in bill of 960 ETB (2 Tibs + 1 Coffee) by the given waiter. */
async function openBill(token = r.waiter.token, table = 0) {
  const res = await app.inject({
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
  });
  return (res.json() as { id: string }).id;
}

const pay = (billId: string, body: object, token = r.waiter.token, key = newKey(), target = app) =>
  target.inject({
    method: 'POST',
    url: `/api/v1/bills/${billId}/payments`,
    headers: headers(token, key),
    payload: body,
  });
const get = (url: string, token: string) =>
  app.inject({ method: 'GET', url: `/api/v1${url}`, headers: headers(token) });

describe('cash only', () => {
  it('extra kept as tip: bill paid, payment and tip saved for the bill waiter', async () => {
    const billId = await openBill();
    const res = await pay(billId, { method: 'cash', cashEtb: 1000, extraChoice: 'tip' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: 'paid',
      totalEtb: 960,
      cashEtb: 1000,
      tipEtb: 40,
      changeEtb: 0,
    });

    const bill = (await get(`/bills/${billId}`, r.owner.token)).json() as { status: string };
    expect(bill.status).toBe('paid');
    const tip = await app.prisma.tip.findFirstOrThrow({ where: { billId } });
    expect(tip).toMatchObject({
      amountEtb: 40,
      source: 'cash',
      waiterId: r.waiter.memberId,
      paidOut: false,
    });

    expect(code(await pay(billId, { method: 'cash', cashEtb: 1000 }))).toBe('BILL_CLOSED');
    // Paid bills leave the open list and free the table.
    expect(
      ((await get('/bills?status=open', r.owner.token)).json() as { items: unknown[] }).items
    ).toEqual([]);
    const tables = (await get('/tables', r.waiter.token)).json() as { id: string; busy: boolean }[];
    expect(tables.find((t) => t.id === r.tables[0]!.id)?.busy).toBe(false);
  });

  it('extra given back as change: no tip; not enough cash is refused', async () => {
    const billId = await openBill();
    const short = await pay(billId, { method: 'cash', cashEtb: 900 });
    expect(code(short)).toBe('VALIDATION_ERROR');
    expect((short.json() as { error: { details: object } }).error.details).toMatchObject({
      missingEtb: 60,
    });

    const res = await pay(billId, { method: 'cash', cashEtb: 1000, extraChoice: 'giveback' });
    expect(res.json()).toMatchObject({ status: 'paid', tipEtb: 0, changeEtb: 40 });
    expect(await app.prisma.tip.count()).toBe(0);
  });
});

describe('bank and cash + bank (fake bank check)', () => {
  it('exact amount pays the bill', async () => {
    const billId = await openBill();
    const res = (
      await pay(billId, { method: 'bank', bankReceivedEtb: 960, reference: 'FT123' })
    ).json() as Result;
    expect(res).toMatchObject({
      status: 'paid',
      expectedBankEtb: 960,
      bankReceivedEtb: 960,
      tipEtb: 0,
    });
    const payment = await app.prisma.payment.findFirstOrThrow({ where: { billId } });
    expect(payment).toMatchObject({ method: 'bank', bankEtb: 960, cashEtb: 0 });
  });

  it('more than expected: the extra is the waiter tip (source bank)', async () => {
    const billId = await openBill();
    const res = (await pay(billId, { method: 'bank', bankReceivedEtb: 1160 })).json() as Result;
    expect(res).toMatchObject({ status: 'over', tipEtb: 200 });
    expect(await app.prisma.tip.findFirstOrThrow({ where: { billId } })).toMatchObject({
      amountEtb: 200,
      source: 'bank',
    });
  });

  it('more than expected, given back: no tip; the extra is change paid from the cash drawer', async () => {
    const billId = await openBill();
    const res = (
      await pay(billId, { method: 'bank', bankReceivedEtb: 1160, extraChoice: 'giveback' })
    ).json() as Result;
    expect(res).toMatchObject({ status: 'over', tipEtb: 0, changeEtb: 200, bankReceivedEtb: 1160 });
    expect(await app.prisma.tip.count({ where: { billId } })).toBe(0);
    expect(await app.prisma.payment.findFirstOrThrow({ where: { billId } })).toMatchObject({
      bankEtb: 1160,
      tipEtb: 0,
      changeEtb: 200,
    });
  });

  it('short keeps the bill open; the next scan adds up; a replayed scan counts once', async () => {
    const billId = await openBill();
    const key = newKey();
    const first = (
      await pay(billId, { method: 'bank', bankReceivedEtb: 860 }, r.waiter.token, key)
    ).json() as Result;
    expect(first).toMatchObject({ status: 'short', bankReceivedEtb: 860, remainingEtb: 100 });
    // The same scan sent again (lost answer) is not counted twice.
    const again = (
      await pay(billId, { method: 'bank', bankReceivedEtb: 860 }, r.waiter.token, key)
    ).json() as Result;
    expect(again).toMatchObject({ status: 'short', bankReceivedEtb: 860, remainingEtb: 100 });
    expect(
      ((await get(`/bills/${billId}`, r.owner.token)).json() as { status: string }).status
    ).toBe('open');

    const second = (await pay(billId, { method: 'bank', bankReceivedEtb: 100 })).json() as Result;
    expect(second).toMatchObject({ status: 'paid', bankReceivedEtb: 960, remainingEtb: 0 });
    expect(await app.prisma.billPaymentScan.count({ where: { billId } })).toBe(2);
  });

  it('cash + bank: bank covers the rest; cash must be part of the total', async () => {
    const billId = await openBill();
    expect(code(await pay(billId, { method: 'cash+bank', cashEtb: 960, bankReceivedEtb: 0 }))).toBe(
      'VALIDATION_ERROR'
    );
    const res = (
      await pay(billId, { method: 'cash+bank', cashEtb: 500, bankReceivedEtb: 460 })
    ).json() as Result;
    expect(res).toMatchObject({
      status: 'paid',
      cashEtb: 500,
      expectedBankEtb: 460,
      bankReceivedEtb: 460,
    });
    expect(await app.prisma.payment.findFirstOrThrow({ where: { billId } })).toMatchObject({
      method: 'cash_bank',
    });
  });

  it('production refuses unverified bank amounts unless switched on; cash still works', async () => {
    const prod = await createTestApp({ NODE_ENV: 'production' });
    try {
      const billId = await openBill();
      expect(
        code(
          await pay(
            billId,
            { method: 'bank', bankReceivedEtb: 960 },
            r.waiter.token,
            newKey(),
            prod
          )
        )
      ).toBe('PAYMENT_NOT_CONFIGURED');
      expect(
        (await pay(billId, { method: 'cash', cashEtb: 960 }, r.waiter.token, newKey(), prod))
          .statusCode
      ).toBe(200);
    } finally {
      await prod.close();
    }
  });

  it('waiters pay only their own bills; chef cannot pay; other business cannot', async () => {
    const billId = await openBill(r.waiter.token);
    expect(code(await pay(billId, { method: 'cash', cashEtb: 960 }, r.waiter2.token))).toBe(
      'NOT_FOUND'
    );
    expect(code(await pay(billId, { method: 'cash', cashEtb: 960 }, r.chef.token))).toBe(
      'FORBIDDEN'
    );
    const other = await createRestaurant(app);
    expect(code(await pay(billId, { method: 'cash', cashEtb: 960 }, other.owner.token))).toBe(
      'NOT_FOUND'
    );
    expect((await pay(billId, { method: 'cash', cashEtb: 960 }, r.manager.token)).statusCode).toBe(
      200
    );
  });
});

describe('tips and overview', () => {
  it('tips: waiter sees own, owner sees all and marks them paid', async () => {
    const a = await openBill(r.waiter.token, 0);
    const b = await openBill(r.waiter2.token, 1);
    await pay(a, { method: 'cash', cashEtb: 1000 }, r.waiter.token);
    await pay(b, { method: 'bank', bankReceivedEtb: 1010 }, r.waiter2.token);

    const mine = (await get('/tips?period=today', r.waiter.token)).json() as {
      amountEtb: number;
      label: string;
    }[];
    expect(mine).toEqual([
      expect.objectContaining({ amountEtb: 40, label: 'Table 1', source: 'cash' }),
    ]);
    const all = (await get('/tips', r.owner.token)).json() as { id: string; waiterName: string }[];
    expect(all.map((t) => t.waiterName).sort()).toEqual(['Waiter Dawit', 'Waiter Selam']);

    const marked = await app.inject({
      method: 'POST',
      url: '/api/v1/tips/mark-paid',
      headers: headers(r.manager.token),
      payload: { tipIds: all.map((t) => t.id) },
    });
    expect(marked.json()).toEqual({ updated: 2 });
    expect(await app.prisma.tip.count({ where: { paidOut: true } })).toBe(2);
    const byWaiter = await app.inject({
      method: 'POST',
      url: '/api/v1/tips/mark-paid',
      headers: headers(r.waiter.token),
      payload: { tipIds: [all[0]!.id] },
    });
    expect(code(byWaiter)).toBe('FORBIDDEN');
  });

  it('overview: sales split cash/bank without tips; open bills; delivery fee changes', async () => {
    const cashBill = await openBill(r.waiter.token, 0); // 960
    const bankBill = await openBill(r.waiter.token, 1); // 960
    await openBill(r.waiter.token, 2); // stays open
    await pay(cashBill, { method: 'cash', cashEtb: 1000, extraChoice: 'giveback' }); // change 40
    await pay(bankBill, { method: 'cash+bank', cashEtb: 200, bankReceivedEtb: 860 }); // tip 100 from bank

    const delivery = (
      await app.inject({
        method: 'POST',
        url: '/api/v1/orders',
        headers: headers(r.feeWaiter.token, newKey()),
        payload: {
          type: 'delivery',
          deliveryAreaId: r.bole.id,
          address: 'Bole',
          customerPhone: '0911223344',
          items: [{ menuItemId: r.menu.coffee.id, quantity: 1 }],
        },
      })
    ).json() as { id: string };
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/bills/${delivery.id}/delivery-fee`,
      headers: headers(r.feeWaiter.token),
      payload: { amount: 100 },
    });

    const overview = (await get('/overview?period=today', r.owner.token)).json();
    expect(overview).toMatchObject({
      period: 'today',
      salesEtb: 1920,
      cashEtb: 960 + 200,
      bankEtb: 760,
      tipsEtb: 100,
      paidBills: 2,
      orders: 4,
      openBills: 2,
      openTables: 1,
      deliveryFeeChanges: {
        count: 1,
        latest: [{ billId: delivery.id, changedBy: 'Waiter Fee', usualFeeEtb: 80, feeEtb: 100 }],
      },
    });
    expect(code(await get('/overview', r.waiter.token))).toBe('FORBIDDEN');
  });
});
