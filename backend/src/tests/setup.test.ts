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
let r: Restaurant; // tables main 1-3 (+ inactive 9), area Bole 80, packing fee 30

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
const call = (
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  token: string,
  payload?: object
) =>
  app.inject({
    method,
    url: `/api/v1${url}`,
    headers: headers(token),
    ...(payload && { payload }),
  });
const code = (res: Res) => (res.json() as { error?: { code?: string } }).error?.code;

interface Table {
  id: string;
  number: number;
  categoryId: string;
  categoryName: string;
  busy: boolean;
}
interface Fees {
  packingFeeEtb: number;
  deliveryAreas: { id: string; name: string; usualFeeEtb: number }[];
}

describe('tables setup', () => {
  it('adds tables (skips existing, brings back removed) and removes them', async () => {
    const res = await call('POST', '/tables', r.manager.token, {
      categoryId: r.tableCategory.id,
      numbers: [2, 3, 4, 9],
    });
    expect(res.statusCode).toBe(200);
    const main = (res.json() as Table[])
      .filter((t) => t.categoryName === 'Main Floor')
      .map((t) => t.number);
    expect(main).toEqual([1, 2, 3, 4, 9]); // 9 was removed before, now back
    const upstairs = (
      await call('POST', '/tables/categories', r.owner.token, { name: 'Upstairs' })
    ).json() as { id: string };
    await call('POST', '/tables', r.owner.token, { categoryId: upstairs.id, numbers: [1, 2] });
    expect(await app.prisma.restaurantTable.count({ where: { businessId: r.businessId } })).toBe(7);

    const t1 = r.tables[0]!;
    expect((await call('DELETE', `/tables/${t1.id}`, r.owner.token)).statusCode).toBe(204);
    const after = (await call('GET', '/tables', r.waiter.token)).json() as Table[];
    expect(after.map((t) => t.id)).not.toContain(t1.id);
    expect(code(await call('DELETE', `/tables/${t1.id}`, r.owner.token))).toBe('NOT_FOUND');
  });

  it('a table with an open bill cannot be removed', async () => {
    const t2 = r.tables[1]!;
    const order = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers: headers(r.waiter.token, newKey()),
      payload: {
        type: 'dine',
        tableId: t2.id,
        items: [{ menuItemId: r.menu.tibs.id, quantity: 1 }],
      },
    });
    expect(order.statusCode).toBe(201);
    expect(code(await call('DELETE', `/tables/${t2.id}`, r.owner.token))).toBe('TABLE_BUSY');
  });

  it('owner/manager only; bad input rejected; other businesses isolated', async () => {
    expect(
      code(
        await call('POST', '/tables', r.waiter.token, {
          categoryId: r.tableCategory.id,
          numbers: [5],
        })
      )
    ).toBe('FORBIDDEN');
    expect(code(await call('DELETE', `/tables/${r.tables[0]!.id}`, r.chef.token))).toBe(
      'FORBIDDEN'
    );
    for (const body of [
      { numbers: [1] },
      { categoryId: r.tableCategory.id, numbers: [] },
      { categoryId: r.tableCategory.id, numbers: [0] },
    ]) {
      expect(code(await call('POST', '/tables', r.owner.token, body))).toBe('VALIDATION_ERROR');
    }
    const other = await createRestaurant(app);
    expect(code(await call('DELETE', `/tables/${r.tables[0]!.id}`, other.owner.token))).toBe(
      'NOT_FOUND'
    );
  });
});

describe('fees setup', () => {
  it('reads fees; saves packing fee and the area list in one go', async () => {
    expect((await call('GET', '/fees', r.waiter.token)).json()).toEqual({
      packingFeeEtb: 30,
      deliveryAreas: [{ id: r.bole.id, name: 'Bole', usualFeeEtb: 80 }],
    });

    const saved = await call('PUT', '/fees', r.owner.token, {
      packingFeeEtb: 25,
      deliveryAreas: [
        { id: r.bole.id, name: 'Bole', usualFeeEtb: 90 },
        { name: 'Piassa', usualFeeEtb: 100 },
      ],
    });
    expect(saved.statusCode).toBe(200);
    const fees = saved.json() as Fees;
    expect(fees.packingFeeEtb).toBe(25);
    expect(fees.deliveryAreas.map((a) => [a.name, a.usualFeeEtb])).toEqual([
      ['Bole', 90],
      ['Piassa', 100],
    ]);

    // Leaving Bole out removes it (kept for past bills); adding it back by name revives it.
    const removed = (
      await call('PUT', '/fees', r.manager.token, {
        packingFeeEtb: 25,
        deliveryAreas: [{ id: fees.deliveryAreas[1]!.id, name: 'Piassa', usualFeeEtb: 100 }],
      })
    ).json() as Fees;
    expect(removed.deliveryAreas.map((a) => a.name)).toEqual(['Piassa']);
    const back = (
      await call('PUT', '/fees', r.manager.token, {
        packingFeeEtb: 25,
        deliveryAreas: [
          { name: 'piassa ', usualFeeEtb: 100 },
          { name: 'Bole', usualFeeEtb: 70 },
        ],
      })
    ).json() as Fees;
    expect(back.deliveryAreas.find((a) => a.name === 'Bole')?.id).toBe(r.bole.id);
    expect(await app.prisma.deliveryArea.count({ where: { businessId: r.businessId } })).toBe(2);
  });

  it('new orders use the saved fees', async () => {
    await call('PUT', '/fees', r.owner.token, {
      packingFeeEtb: 20,
      deliveryAreas: [{ id: r.bole.id, name: 'Bole', usualFeeEtb: 95 }],
    });
    const bill = (
      await app.inject({
        method: 'POST',
        url: '/api/v1/orders',
        headers: headers(r.waiter.token, newKey()),
        payload: {
          type: 'delivery',
          deliveryAreaId: r.bole.id,
          address: 'Near Edna Mall',
          customerPhone: '0911223344',
          items: [{ menuItemId: r.menu.coffee.id, quantity: 1 }],
        },
      })
    ).json() as { packingFeeEtb: number; deliveryFeeEtb: number; totalEtb: number };
    expect(bill).toMatchObject({ packingFeeEtb: 20, deliveryFeeEtb: 95, totalEtb: 60 + 20 + 95 });
  });

  it('rejects duplicates, unknown ids, bad fees and other roles', async () => {
    const put = (token: string, body: object) => call('PUT', '/fees', token, body);
    expect(
      code(
        await put(r.owner.token, {
          packingFeeEtb: 30,
          deliveryAreas: [
            { name: 'Bole', usualFeeEtb: 1 },
            { name: 'BOLE', usualFeeEtb: 2 },
          ],
        })
      )
    ).toBe('VALIDATION_ERROR');
    expect(
      code(
        await put(r.owner.token, {
          packingFeeEtb: 30,
          deliveryAreas: [{ id: 'nope', name: 'X', usualFeeEtb: 1 }],
        })
      )
    ).toBe('NOT_FOUND');
    expect(code(await put(r.owner.token, { packingFeeEtb: -1, deliveryAreas: [] }))).toBe(
      'VALIDATION_ERROR'
    );
    expect(code(await put(r.owner.token, { packingFeeEtb: 12.5, deliveryAreas: [] }))).toBe(
      'VALIDATION_ERROR'
    );
    expect(code(await put(r.waiter.token, { packingFeeEtb: 30, deliveryAreas: [] }))).toBe(
      'FORBIDDEN'
    );
    expect(code(await call('GET', '/fees', r.chef.token))).toBe('FORBIDDEN');

    const other = await createRestaurant(app);
    expect(
      code(
        await put(other.owner.token, {
          packingFeeEtb: 30,
          deliveryAreas: [{ id: r.bole.id, name: 'Bole', usualFeeEtb: 1 }],
        })
      )
    ).toBe('NOT_FOUND');
    const normal = await createRestaurant(app, 'normal');
    expect(code(await call('GET', '/fees', normal.owner.token))).toBe('SUBSCRIPTION_REQUIRED');
  });
});
