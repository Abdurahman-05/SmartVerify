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
let r: Restaurant;

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

const order = (token: string, body: object, key = newKey()) =>
  app.inject({
    method: 'POST',
    url: '/api/v1/orders',
    headers: headers(token, key),
    payload: body,
  });

const get = (token: string, url: string) =>
  app.inject({ method: 'GET', url: `/api/v1${url}`, headers: headers(token) });

const dine = (tableId: string, extra: object = {}) => ({
  type: 'dine',
  tableId,
  guests: 2,
  notes: ['noOnion'],
  items: [
    { menuItemId: r.menu.tibs.id, quantity: 2 },
    { menuItemId: r.menu.coffee.id, quantity: 1 },
  ],
  ...extra,
});

const takeaway = (extra: object = {}) => ({
  type: 'takeaway',
  customerName: 'Meron',
  items: [{ menuItemId: r.menu.coffee.id, quantity: 3 }],
  ...extra,
});

const delivery = () => ({
  type: 'delivery',
  deliveryAreaId: r.bole.id,
  address: 'Bole, near Edna Mall',
  customerPhone: '0911223344',
  items: [{ menuItemId: r.menu.tibs.id, quantity: 1 }],
});

const errorCode = (res: { json: () => unknown }) =>
  (res.json() as { error?: { code?: string } }).error?.code;

describe('POST /orders — totals', () => {
  it('dine-in: food only, no packing or delivery fee', async () => {
    const res = await order(r.waiter.token, dine(r.tables[0]!.id));
    expect(res.statusCode).toBe(201);
    const bill = res.json();
    expect(bill).toMatchObject({
      label: 'Table 1',
      type: 'dine',
      tableNumber: 1,
      guests: 2,
      foodTotalEtb: 960, // 2 × 450 + 60
      packingFeeEtb: 0,
      deliveryFeeEtb: 0,
      usualDeliveryFeeEtb: null,
      totalEtb: 960,
      bankReceivedEtb: 0,
      status: 'open',
      servedStatus: 'kitchen',
      kitchenStatus: 'new',
      waiterName: 'Waiter Dawit',
    });
    expect(bill.orders).toHaveLength(1);
    expect(bill.orders[0]).toMatchObject({
      number: 1001,
      notes: ['noOnion'],
      kitchenStatus: 'new',
    });
    expect(bill.orders[0].items).toEqual([
      { menuItemId: r.menu.tibs.id, name: 'Tibs', priceEtb: 450, quantity: 2 },
      { menuItemId: r.menu.coffee.id, name: 'Coffee', priceEtb: 60, quantity: 1 },
    ]);
    expect(await app.prisma.kitchenOrder.count()).toBe(1);
  });

  it('takeaway: food + packing fee', async () => {
    const bill = (await order(r.waiter.token, takeaway())).json();
    expect(bill).toMatchObject({
      label: 'Takeaway #1001',
      customerName: 'Meron',
      foodTotalEtb: 180,
      packingFeeEtb: 30,
      deliveryFeeEtb: 0,
      totalEtb: 210,
    });
  });

  it("delivery: food + packing + the area's usual fee", async () => {
    const bill = (await order(r.waiter.token, delivery())).json();
    expect(bill).toMatchObject({
      label: 'Delivery #1001',
      deliveryAreaName: 'Bole',
      address: 'Bole, near Edna Mall',
      customerPhone: '0911223344',
      foodTotalEtb: 450,
      packingFeeEtb: 30,
      deliveryFeeEtb: 80,
      usualDeliveryFeeEtb: 80,
      totalEtb: 560,
      deliveryFeeChangedBy: null,
    });
  });
});

describe('POST /orders — prices and menu', () => {
  it('ignores prices sent by the client', async () => {
    const body = {
      ...takeaway(),
      items: [{ menuItemId: r.menu.tibs.id, quantity: 1, priceEtb: 1 }],
      foodTotalEtb: 1,
      totalEtb: 1,
    };
    const bill = (await order(r.waiter.token, body)).json();
    expect(bill.orders[0].items[0].priceEtb).toBe(450);
    expect(bill.totalEtb).toBe(480);
  });

  it('inactive menu item -> ITEM_UNAVAILABLE, nothing created', async () => {
    const res = await order(r.waiter.token, {
      ...takeaway(),
      items: [{ menuItemId: r.menu.retired.id, quantity: 1 }],
    });
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe('ITEM_UNAVAILABLE');
    expect(await app.prisma.bill.count()).toBe(0);
    expect(await app.prisma.order.count()).toBe(0);
  });

  it('rejects invalid bodies with VALIDATION_ERROR', async () => {
    const cases = [
      { type: 'dine', items: [{ menuItemId: r.menu.tibs.id, quantity: 1 }] }, // no tableId
      { type: 'takeaway', items: [{ menuItemId: r.menu.tibs.id, quantity: 1 }] }, // no customerName
      { ...delivery(), customerPhone: '911223344' }, // phone not 10 digits
      { ...takeaway(), items: [] },
      { ...takeaway(), items: [{ menuItemId: r.menu.tibs.id, quantity: 100 }] },
      { ...takeaway(), notes: ['extraSalt'] },
    ];
    for (const body of cases) {
      const res = await order(r.waiter.token, body);
      expect(res.statusCode, JSON.stringify(body)).toBe(400);
      expect(errorCode(res)).toBe('VALIDATION_ERROR');
    }
  });

  it('requires an Idempotency-Key header', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers: headers(r.waiter.token),
      payload: takeaway(),
    });
    expect(res.statusCode).toBe(400);
  });

  it('inactive table -> NOT_FOUND; chef cannot order', async () => {
    const inactive = r.tables.find((t) => !t.active)!;
    expect(errorCode(await order(r.waiter.token, dine(inactive.id)))).toBe('NOT_FOUND');
    expect((await order(r.chef.token, takeaway())).statusCode).toBe(403);
  });
});

describe('POST /orders — idempotency and concurrency', () => {
  it('same Idempotency-Key twice -> one order, one bill, same response', async () => {
    const key = newKey();
    const first = await order(r.waiter.token, takeaway(), key);
    const second = await order(r.waiter.token, takeaway(), key);
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(second.json()).toEqual(first.json());
    expect(await app.prisma.order.count()).toBe(1);
    expect(await app.prisma.bill.count()).toBe(1);
  });

  it('same Idempotency-Key at the same moment -> still one order', async () => {
    const key = newKey();
    const [a, b] = await Promise.all([
      order(r.waiter.token, takeaway(), key),
      order(r.waiter.token, takeaway(), key),
    ]);
    expect([a.statusCode, b.statusCode]).toEqual([201, 201]);
    expect(a.json().id).toBe(b.json().id);
    expect(await app.prisma.order.count()).toBe(1);
    expect(await app.prisma.bill.count()).toBe(1);
  });

  it('20 parallel orders get 20 unique, sequential numbers', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => order(r.waiter.token, takeaway()))
    );
    const failed = results.filter((res) => res.statusCode !== 201).map((res) => res.body);
    expect(failed).toEqual([]);
    const numbers = results
      .map((res) => res.json().orders[0].number as number)
      .sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 20 }, (_, i) => 1001 + i));
    const business = await app.prisma.business.findUniqueOrThrow({ where: { id: r.businessId } });
    expect(business.nextOrderNumber).toBe(1021);
  });

  it('two parallel dine-in orders on one table -> one OK, one TABLE_BUSY', async () => {
    const table = r.tables[0]!;
    const results = await Promise.all([
      order(r.waiter.token, dine(table.id)),
      order(r.waiter2.token, dine(table.id)),
    ]);
    const codes = results.map((res) => res.statusCode).sort();
    expect(codes).toEqual([201, 409]);
    expect(results.map(errorCode)).toContain('TABLE_BUSY');
    expect(await app.prisma.bill.count()).toBe(1);
    // The failed order did not use up an order number.
    const business = await app.prisma.business.findUniqueOrThrow({ where: { id: r.businessId } });
    expect(business.nextOrderNumber).toBe(1002);

    const tables = (await get(r.waiter.token, '/tables')).json();
    const winner = results.find((res) => res.statusCode === 201)!.json();
    expect(tables).toContainEqual({
      id: table.id,
      number: 1,
      categoryId: expect.any(String),
      categoryName: 'Main Floor',
      categoryNameAm: 'ዋናው ወለል',
      busy: true,
      openBillId: winner.id,
    });
    expect(tables.find((t: { number: number }) => t.number === 2)).toMatchObject({
      busy: false,
      openBillId: null,
    });
    expect(tables.map((t: { number: number }) => t.number)).not.toContain(9); // inactive hidden
  });
});

describe('GET /bills', () => {
  it('waiter sees own bills only; manager sees all; chef FORBIDDEN', async () => {
    const mine = (await order(r.waiter.token, takeaway())).json();
    const theirs = (await order(r.waiter2.token, dine(r.tables[1]!.id))).json();

    const waiterList = (await get(r.waiter.token, '/bills')).json();
    expect(waiterList.items.map((b: { id: string }) => b.id)).toEqual([mine.id]);

    const managerList = (await get(r.manager.token, '/bills?status=open')).json();
    expect(managerList.items.map((b: { id: string }) => b.id).sort()).toEqual(
      [mine.id, theirs.id].sort()
    );
    expect(managerList.items[0]).toMatchObject({
      waiterName: expect.any(String),
      kitchenStatus: 'new',
    });

    const managerMine = (await get(r.manager.token, '/bills?mine=true')).json();
    expect(managerMine.items).toEqual([]);

    const dineOnly = (await get(r.owner.token, '/bills?type=dine')).json();
    expect(dineOnly.items.map((b: { id: string }) => b.id)).toEqual([theirs.id]);

    expect((await get(r.chef.token, '/bills')).statusCode).toBe(403);
    expect((await get(r.chef.token, `/bills/${mine.id}`)).statusCode).toBe(403);

    // A waiter cannot open another waiter's bill.
    expect(errorCode(await get(r.waiter.token, `/bills/${theirs.id}`))).toBe('NOT_FOUND');
    expect((await get(r.waiter2.token, `/bills/${theirs.id}`)).json().id).toBe(theirs.id);
  });

  it('paginates newest first with a cursor', async () => {
    for (let i = 0; i < 3; i++) await order(r.waiter.token, takeaway());
    const page1 = (await get(r.manager.token, '/bills?limit=2')).json();
    expect(page1.items.map((b: { label: string }) => b.label)).toEqual([
      'Takeaway #1003',
      'Takeaway #1002',
    ]);
    expect(page1.nextCursor).toBeTruthy();
    const page2 = (await get(r.manager.token, `/bills?limit=2&cursor=${page1.nextCursor}`)).json();
    expect(page2.items.map((b: { label: string }) => b.label)).toEqual(['Takeaway #1001']);
    expect(page2.nextCursor).toBeNull();
  });
});

describe('PATCH /bills/:id/delivery-fee', () => {
  const patchFee = (token: string, billId: string, amount: number) =>
    app.inject({
      method: 'PATCH',
      url: `/api/v1/bills/${billId}/delivery-fee`,
      headers: headers(token),
      payload: { amount },
    });

  it('needs owner, manager or canChangeDeliveryFee; recalculates the total', async () => {
    const own = (await order(r.waiter.token, delivery())).json();
    const res = await patchFee(r.waiter.token, own.id, 120);
    expect(res.statusCode).toBe(403);
    expect(errorCode(res)).toBe('FORBIDDEN');

    const feeBill = (await order(r.feeWaiter.token, delivery())).json();
    const changed = await patchFee(r.feeWaiter.token, feeBill.id, 120);
    expect(changed.statusCode).toBe(200);
    expect(changed.json()).toMatchObject({
      deliveryFeeEtb: 120,
      usualDeliveryFeeEtb: 80,
      totalEtb: 450 + 30 + 120,
      deliveryFeeChangedBy: 'Waiter Fee',
    });
    const row = await app.prisma.bill.findUniqueOrThrow({ where: { id: feeBill.id } });
    expect(row.deliveryFeeChangedById).toBe(r.feeWaiter.memberId);
    expect(row.totalEtb).toBe(600);

    const byManager = (await patchFee(r.manager.token, own.id, 0)).json();
    expect(byManager).toMatchObject({
      deliveryFeeEtb: 0,
      totalEtb: 480,
      deliveryFeeChangedBy: 'Manager Yonas',
    });
  });

  it('rejects dine-in bills and paid bills', async () => {
    const dineBill = (await order(r.waiter.token, dine(r.tables[0]!.id))).json();
    const res = await patchFee(r.owner.token, dineBill.id, 50);
    expect(res.statusCode).toBe(400);
    expect(errorCode(res)).toBe('VALIDATION_ERROR');

    const deliveryBill = (await order(r.waiter.token, delivery())).json();
    await app.prisma.bill.update({
      where: { id: deliveryBill.id },
      data: { status: 'paid', paidAt: new Date() },
    });
    expect(errorCode(await patchFee(r.owner.token, deliveryBill.id, 50))).toBe('BILL_CLOSED');
  });
});

describe('plan and business isolation', () => {
  it('normal plan and no plan -> SUBSCRIPTION_REQUIRED', async () => {
    for (const plan of ['normal', null] as const) {
      const other = await createRestaurant(app, plan);
      for (const res of [
        await order(other.waiter.token, takeaway()),
        await get(other.waiter.token, '/bills'),
        await get(other.owner.token, '/tables'),
      ]) {
        expect(res.statusCode).toBe(402);
        expect(errorCode(res)).toBe('SUBSCRIPTION_REQUIRED');
      }
    }
  });

  it("another business cannot see or use this business's bills, tables or menu", async () => {
    const bill = (await order(r.waiter.token, delivery())).json();
    const other = await createRestaurant(app);

    expect((await get(other.owner.token, '/bills')).json().items).toEqual([]);
    expect(errorCode(await get(other.owner.token, `/bills/${bill.id}`))).toBe('NOT_FOUND');
    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/v1/bills/${bill.id}/delivery-fee`,
      headers: headers(other.owner.token),
      payload: { amount: 1 },
    });
    expect(errorCode(patched)).toBe('NOT_FOUND');

    const otherTables = (await get(other.owner.token, '/tables')).json();
    expect(otherTables.map((t: { id: string }) => t.id).sort()).toEqual(
      other.tables
        .filter((t) => t.active)
        .map((t) => t.id)
        .sort()
    );

    // Using this business's table or menu item from the other business.
    expect(
      errorCode(
        await order(other.waiter.token, {
          ...dine(r.tables[0]!.id),
          items: [{ menuItemId: other.menu.tibs.id, quantity: 1 }],
        })
      )
    ).toBe('NOT_FOUND');
    expect(errorCode(await order(other.waiter.token, takeaway()))).toBe('ITEM_UNAVAILABLE');
  });
});
