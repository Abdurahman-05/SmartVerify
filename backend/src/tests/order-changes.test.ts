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

interface Bill {
  id: string;
  status: string;
  foodTotalEtb: number;
  totalEtb: number;
  orders: {
    id: string;
    items: { name: string; quantity: number }[];
    edited: boolean;
    cancelled: boolean;
    cancelReason: string | null;
  }[];
}

const call = (
  method: 'GET' | 'POST' | 'PUT',
  url: string,
  token: string,
  payload?: object,
  key?: string
) => app.inject({ method, url: `/api/v1${url}`, headers: headers(token, key), payload });

/** Table 1, two Tibs (450 each). */
const openTable = async (token = r.waiter.token) =>
  (
    await call(
      'POST',
      '/orders',
      token,
      {
        type: 'dine',
        tableId: r.tables[0]!.id,
        items: [{ menuItemId: r.menu.tibs.id, quantity: 2 }],
      },
      newKey()
    )
  ).json() as Bill;

const code = (res: { json: () => unknown }) =>
  (res.json() as { error?: { code?: string; details?: { reason?: string } } }).error;

const ticketOf = async (orderId: string) =>
  app.prisma.kitchenOrder.findUnique({ where: { orderId } });

describe('adding to, changing and cancelling orders', () => {
  it('more items go on the same bill as a new kitchen ticket; the chef is told', async () => {
    const bill = await openTable();
    const key = newKey();
    const more = { items: [{ menuItemId: r.menu.coffee.id, quantity: 3 }] };
    const added = (
      await call('POST', `/bills/${bill.id}/orders`, r.waiter.token, more, key)
    ).json() as Bill;
    expect(added).toMatchObject({ foodTotalEtb: 900 + 180, totalEtb: 1080 });
    expect(added.orders).toHaveLength(2);
    // The same action again adds nothing.
    const again = (
      await call('POST', `/bills/${bill.id}/orders`, r.waiter.token, more, key)
    ).json() as Bill;
    expect(again.orders).toHaveLength(2);
    expect(await app.prisma.kitchenOrder.count()).toBe(2);
    expect(
      await app.prisma.notification.count({
        where: { memberId: r.chef.memberId, type: 'order_added' },
      })
    ).toBe(1);
    // Another waiter cannot add to it.
    const other = await call('POST', `/bills/${bill.id}/orders`, r.waiter2.token, more, newKey());
    expect(other.statusCode).toBe(404);
  });

  it('before cooking an order can change; once cooking starts it is locked', async () => {
    const bill = await openTable();
    const orderId = bill.orders[0]!.id;
    const changed = (
      await call('PUT', `/orders/${orderId}/items`, r.waiter.token, {
        items: [{ menuItemId: r.menu.tibs.id, quantity: 1 }],
      })
    ).json() as Bill;
    expect(changed).toMatchObject({ foodTotalEtb: 450, totalEtb: 450 });
    expect(changed.orders[0]).toMatchObject({
      edited: true,
      items: [{ name: 'Tibs', quantity: 1 }],
    });

    // Another waiter's order: no.
    const notMine = await call('PUT', `/orders/${orderId}/items`, r.waiter2.token, {
      items: [{ menuItemId: r.menu.tibs.id, quantity: 5 }],
    });
    expect(notMine.statusCode).toBe(403);

    const ticket = await ticketOf(orderId);
    await call('POST', `/kitchen/orders/${ticket!.id}/start`, r.chef.token);
    const late = await call('PUT', `/orders/${orderId}/items`, r.manager.token, {
      items: [{ menuItemId: r.menu.tibs.id, quantity: 3 }],
    });
    expect(code(late)).toMatchObject({ code: 'ORDER_LOCKED', details: { reason: 'cooking' } });
    const cancel = await call('POST', `/orders/${orderId}/cancel`, r.owner.token, {
      reason: 'Customer left',
    });
    expect(code(cancel)).toMatchObject({ code: 'ORDER_LOCKED', details: { reason: 'cooking' } });
  });

  it('cancelling before cooking: leaves the kitchen and the total; the last one frees the table', async () => {
    const bill = await openTable();
    const extra = (
      await call(
        'POST',
        `/bills/${bill.id}/orders`,
        r.waiter.token,
        { items: [{ menuItemId: r.menu.coffee.id, quantity: 1 }] },
        newKey()
      )
    ).json() as Bill;
    const [first, second] = extra.orders;

    const one = (
      await call('POST', `/orders/${second!.id}/cancel`, r.waiter.token, { reason: 'Mistake' })
    ).json() as Bill;
    expect(one).toMatchObject({ status: 'open', foodTotalEtb: 900, totalEtb: 900 });
    expect(one.orders[1]).toMatchObject({ cancelled: true, cancelReason: 'Mistake' });
    expect(await ticketOf(second!.id)).toBeNull();
    expect(
      await app.prisma.notification.count({
        where: { memberId: r.chef.memberId, type: 'order_cancelled' },
      })
    ).toBe(1);

    const twice = await call('POST', `/orders/${second!.id}/cancel`, r.waiter.token, {
      reason: 'Mistake',
    });
    expect(code(twice)).toMatchObject({ code: 'ORDER_LOCKED', details: { reason: 'cancelled' } });

    const none = (
      await call('POST', `/orders/${first!.id}/cancel`, r.manager.token, {
        reason: 'Customer left',
      })
    ).json() as Bill;
    expect(none).toMatchObject({ status: 'cancelled', foodTotalEtb: 0, totalEtb: 0 });
    // The table is free: a new order on it works.
    expect((await openTable()).status).toBe('open');
  });
});
