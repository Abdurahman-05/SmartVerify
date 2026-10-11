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

type Res = { statusCode: number; json: () => unknown };
const code = (res: Res) => (res.json() as { error?: { code?: string } }).error?.code;
const call = (method: 'GET' | 'POST', url: string, token: string) =>
  app.inject({ method, url: `/api/v1${url}`, headers: headers(token) });

interface Ticket {
  id: string;
  billId: string;
  orderNo: number;
  label: string;
  type: string;
  waiterName: string;
  guests: number | null;
  area: string | null;
  customerName: string | null;
  items: { qty: number; name: string }[];
  notes: string[];
  status: string;
  startedAt: string | null;
}

const sendOrder = (payload: object) =>
  app.inject({
    method: 'POST',
    url: '/api/v1/orders',
    headers: headers(r.waiter.token, newKey()),
    payload,
  });

describe('kitchen', () => {
  it('a sent order shows up as a new ticket with what the chef needs', async () => {
    const bill = (
      await sendOrder({
        type: 'dine',
        tableId: r.tables[1]!.id,
        guests: 3,
        notes: ['noOnion'],
        items: [
          { menuItemId: r.menu.tibs.id, quantity: 2 },
          { menuItemId: r.menu.coffee.id, quantity: 1 },
        ],
      })
    ).json() as { id: string };
    await sendOrder({
      type: 'delivery',
      deliveryAreaId: r.bole.id,
      address: 'Near Edna Mall',
      customerPhone: '0911223344',
      items: [{ menuItemId: r.menu.coffee.id, quantity: 1 }],
    });

    const tickets = (await call('GET', '/kitchen/orders', r.chef.token)).json() as Ticket[];
    expect(tickets).toHaveLength(2);
    expect(tickets[0]).toMatchObject({
      billId: bill.id,
      orderNo: 1001,
      label: 'Table 2',
      type: 'dine',
      waiterName: 'Waiter Dawit',
      guests: 3,
      items: [
        { qty: 2, name: 'Tibs' },
        { qty: 1, name: 'Coffee' },
      ],
      notes: ['noOnion'],
      status: 'new',
      startedAt: null,
    });
    expect(tickets[1]).toMatchObject({ label: 'Delivery #1002', area: 'Bole' });
  });

  it('start cooking, then ready marks the bill served', async () => {
    const bill = (
      await sendOrder({
        type: 'takeaway',
        customerName: 'Abel',
        items: [{ menuItemId: r.menu.tibs.id, quantity: 1 }],
      })
    ).json() as { id: string };
    const [ticket] = (await call('GET', '/kitchen/orders', r.chef.token)).json() as Ticket[];

    const started = (
      await call('POST', `/kitchen/orders/${ticket!.id}/start`, r.chef.token)
    ).json() as Ticket;
    expect(started.status).toBe('cooking');
    expect(started.startedAt).not.toBeNull();
    // Doing it twice is harmless.
    expect(
      ((await call('POST', `/kitchen/orders/${ticket!.id}/start`, r.chef.token)).json() as Ticket)
        .startedAt
    ).toBe(started.startedAt);

    const ready = (
      await call('POST', `/kitchen/orders/${ticket!.id}/ready`, r.manager.token)
    ).json() as Ticket;
    expect(ready.status).toBe('ready');
    const detail = (await call('GET', `/bills/${bill.id}`, r.owner.token)).json() as {
      servedStatus: string;
      kitchenStatus: string;
    };
    expect(detail).toMatchObject({ servedStatus: 'served', kitchenStatus: 'ready' });

    expect(
      (await call('GET', '/kitchen/orders?status=new', r.chef.token)).json() as Ticket[]
    ).toEqual([]);
    expect(
      (await call('GET', '/kitchen/orders?status=ready', r.chef.token)).json() as Ticket[]
    ).toHaveLength(1);
  });

  it('waiters cannot use the kitchen; other businesses cannot see or change tickets', async () => {
    await sendOrder({
      type: 'takeaway',
      customerName: 'Abel',
      items: [{ menuItemId: r.menu.tibs.id, quantity: 1 }],
    });
    const [ticket] = (await call('GET', '/kitchen/orders', r.chef.token)).json() as Ticket[];

    expect(code(await call('GET', '/kitchen/orders', r.waiter.token))).toBe('FORBIDDEN');
    expect(code(await call('POST', `/kitchen/orders/${ticket!.id}/start`, r.waiter.token))).toBe(
      'FORBIDDEN'
    );

    const other = await createRestaurant(app);
    expect((await call('GET', '/kitchen/orders', other.chef.token)).json()).toEqual([]);
    expect(code(await call('POST', `/kitchen/orders/${ticket!.id}/ready`, other.chef.token))).toBe(
      'NOT_FOUND'
    );

    const normal = await createRestaurant(app, 'normal');
    expect(code(await call('GET', '/kitchen/orders', normal.chef.token))).toBe(
      'SUBSCRIPTION_REQUIRED'
    );
  });
});
