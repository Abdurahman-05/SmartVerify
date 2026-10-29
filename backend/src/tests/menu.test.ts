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

const list = (token: string, query = '') =>
  app.inject({ method: 'GET', url: `/api/v1/menu${query}`, headers: headers(token) });
const add = (token: string, body: object, key = newKey()) =>
  app.inject({ method: 'POST', url: '/api/v1/menu', headers: headers(token, key), payload: body });
const patch = (token: string, id: string, body: object) =>
  app.inject({
    method: 'PATCH',
    url: `/api/v1/menu/${id}`,
    headers: headers(token),
    payload: body,
  });

const names = (res: { json: () => unknown }) =>
  (res.json() as { name: string }[]).map((i) => i.name);
const errorCode = (res: { json: () => unknown }) =>
  (res.json() as { error?: { code?: string } }).error?.code;

describe('menu', () => {
  it('waiters and chefs see only items that are on; owner and manager see all', async () => {
    expect(names(await list(r.waiter.token)).sort()).toEqual(['Coffee', 'Tibs']);
    expect(names(await list(r.waiter.token, '?all=true')).sort()).toEqual(['Coffee', 'Tibs']);
    expect(names(await list(r.chef.token)).sort()).toEqual(['Coffee', 'Tibs']);
    // `all=true` (still sent by the app) is no longer needed: owner/manager always get all.
    expect(names(await list(r.manager.token)).sort()).toEqual(['Coffee', 'Old dish', 'Tibs']);
    expect((await list(r.owner.token, '?all=true')).json()).toContainEqual({
      id: r.menu.retired.id,
      name: 'Old dish',
      nameAm: null,
      priceEtb: 100,
      category: 'food',
      categoryId: expect.any(String),
      categoryName: 'Food',
      categoryNameAm: null,
      groupName: null,
      active: false,
      sortOrder: 0,
    });
  });

  it('owner and manager add items; waiters cannot', async () => {
    const res = await add(r.manager.token, { name: '  Kitfo ', priceEtb: 260, category: 'food' });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      name: 'Kitfo',
      priceEtb: 260,
      category: 'food',
      active: true,
    });
    expect(names(await list(r.waiter.token))).toContain('Kitfo');

    expect(
      (await add(r.waiter.token, { name: 'X', priceEtb: 1, category: 'food' })).statusCode
    ).toBe(403);
  });

  it('rejects bad input', async () => {
    for (const body of [
      { name: '', priceEtb: 10, category: 'food' },
      { name: 'Tea', priceEtb: 0, category: 'drinks' },
      { name: 'Tea', priceEtb: 12.5, category: 'drinks' },
      { name: 'Tea', priceEtb: 10, category: 'dessert' },
    ]) {
      expect(errorCode(await add(r.owner.token, body)), JSON.stringify(body)).toBe(
        'VALIDATION_ERROR'
      );
    }
    expect(errorCode(await patch(r.owner.token, r.menu.tibs.id, {}))).toBe('VALIDATION_ERROR');
  });

  it('same Idempotency-Key twice -> one item', async () => {
    const key = newKey();
    const body = { name: 'Shai', priceEtb: 30, category: 'drinks' };
    const [a, b] = await Promise.all([
      add(r.owner.token, body, key),
      add(r.owner.token, body, key),
    ]);
    const c = await add(r.owner.token, body, key);
    expect([a.statusCode, b.statusCode, c.statusCode]).toEqual([201, 201, 201]);
    expect(new Set([a.json().id, b.json().id, c.json().id]).size).toBe(1);
    expect(await app.prisma.menuItem.count({ where: { name: 'Shai' } })).toBe(1);
  });

  it('edit price and turn off/on; past orders keep their price', async () => {
    const before = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers: headers(r.waiter.token, newKey()),
      payload: {
        type: 'takeaway',
        customerName: 'Abel',
        items: [{ menuItemId: r.menu.tibs.id, quantity: 1 }],
      },
    });
    expect(before.statusCode).toBe(201);

    const changed = await patch(r.owner.token, r.menu.tibs.id, {
      priceEtb: 500,
      name: 'Beef Tibs',
    });
    expect(changed.json()).toMatchObject({ name: 'Beef Tibs', priceEtb: 500, active: true });

    const off = await patch(r.manager.token, r.menu.tibs.id, { active: false });
    expect(off.json().active).toBe(false);
    expect(names(await list(r.waiter.token))).not.toContain('Beef Tibs');

    const bill = (
      await app.inject({
        method: 'GET',
        url: `/api/v1/bills/${before.json().id}`,
        headers: headers(r.owner.token),
      })
    ).json();
    expect(bill.orders[0].items[0]).toMatchObject({ name: 'Tibs', priceEtb: 450, quantity: 1 });

    expect((await patch(r.manager.token, r.menu.tibs.id, { active: true })).json().active).toBe(
      true
    );
    expect((await patch(r.waiter.token, r.menu.tibs.id, { active: false })).statusCode).toBe(403);
  });

  it('another business cannot read or edit this menu; normal plan is refused', async () => {
    const other = await createRestaurant(app);
    expect(names(await list(other.owner.token, '?all=true')).sort()).toEqual([
      'Coffee',
      'Old dish',
      'Tibs',
    ]);
    const otherIds = (await list(other.owner.token, '?all=true'))
      .json()
      .map((i: { id: string }) => i.id);
    expect(otherIds).not.toContain(r.menu.tibs.id);
    expect(errorCode(await patch(other.owner.token, r.menu.tibs.id, { priceEtb: 1 }))).toBe(
      'NOT_FOUND'
    );

    const normal = await createRestaurant(app, 'normal');
    expect(errorCode(await list(normal.owner.token))).toBe('SUBSCRIPTION_REQUIRED');
    expect(
      errorCode(await add(normal.owner.token, { name: 'X', priceEtb: 1, category: 'food' }))
    ).toBe('SUBSCRIPTION_REQUIRED');
  });
});
