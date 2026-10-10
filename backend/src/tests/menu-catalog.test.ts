import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { CATALOG } from '../modules/menu/catalog.js';

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
  // Menu: Tibs 450 (food), Coffee 60 (drinks), Old dish 100 (food, off).
  r = await createRestaurant(app);
});

type Res = { statusCode: number; json: () => unknown };
const call = (
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
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
const body = <T>(res: Res) => res.json() as T;

interface Item {
  id: string;
  name: string;
  nameAm: string | null;
  priceEtb: number;
  category: string;
  active: boolean;
  sortOrder: number;
}
interface CatalogEntry {
  key: string;
  group: string;
  category: string;
  alreadyAdded: boolean;
}

const catalog = (token: string, query = '') => call('GET', `/menu/catalog${query}`, token);
const importItems = (token: string, items: object[]) =>
  call('POST', '/menu/catalog/import', token, { items });
const menuOf = async (token: string) => body<Item[]>(await call('GET', '/menu', token));

describe('GET /menu/catalog', () => {
  it('filters by category, group and search, and marks items already on the menu', async () => {
    const drinks = body<CatalogEntry[]>(await catalog(r.owner.token, '?category=drinks'));
    expect(drinks.length).toBe(CATALOG.filter((i) => i.category === 'drinks').length);
    expect(drinks.every((i) => i.category === 'drinks')).toBe(true);

    const juice = body<CatalogEntry[]>(await catalog(r.manager.token, '?group=juice'));
    expect(juice.map((i) => i.key).sort()).toEqual(
      ['avocado-juice', 'mango-juice', 'orange-juice', 'papaya-juice', 'spris-juice'].sort()
    );

    expect(body<CatalogEntry[]>(await catalog(r.owner.token, '?q=doro')).map((i) => i.key)).toEqual(
      ['doro-wat']
    );
    expect(
      body<CatalogEntry[]>(await catalog(r.owner.token, '?q=%E1%88%BD%E1%88%AE'))
        .map((i) => i.key)
        .sort()
    ).toEqual(
      ['shiro', 'shiro-tegabino'] // "ሽሮ"
    );

    // Same name as an existing item counts as already added ("Tibs", "Coffee").
    const all = body<CatalogEntry[]>(await catalog(r.owner.token));
    const flag = (key: string) => all.find((i) => i.key === key)?.alreadyAdded;
    expect([flag('tibs'), flag('coffee'), flag('kitfo')]).toEqual([true, true, false]);
  });
});

describe('POST /menu/catalog/import', () => {
  it('uses suggested prices, custom prices and names, and stores the catalog info', async () => {
    const res = await importItems(r.owner.token, [
      { key: 'doro-wat' },
      { key: 'kitfo', priceEtb: 600 },
      { key: 'macchiato', name: '  House Macchiato ' },
    ]);
    expect(res.statusCode).toBe(200);
    const { created, skipped } = body<{ created: Item[]; skipped: unknown[] }>(res);
    expect(skipped).toEqual([]);
    expect(
      created.map(({ name, nameAm, priceEtb, category, active }) => ({
        name,
        nameAm,
        priceEtb,
        category,
        active,
      }))
    ).toEqual([
      { name: 'Doro Wat', nameAm: 'ዶሮ ወጥ', priceEtb: 450, category: 'food', active: true },
      { name: 'Kitfo', nameAm: 'ክትፎ', priceEtb: 600, category: 'food', active: true },
      { name: 'House Macchiato', nameAm: 'ማኪያቶ', priceEtb: 60, category: 'drinks', active: true },
    ]);
    // Appended after the existing items of each category.
    expect(created.map((i) => i.sortOrder)).toEqual([1, 2, 1]);
    const row = await app.prisma.menuItem.findFirstOrThrow({ where: { name: 'Doro Wat' } });
    expect(row.catalogKey).toBe('doro-wat');

    const after = body<CatalogEntry[]>(await catalog(r.owner.token, '?q=kitfo'));
    expect(after[0]?.alreadyAdded).toBe(true);
  });

  it('skips items already on the menu; importing again is safe', async () => {
    const first = body<{ created: Item[]; skipped: { key: string }[] }>(
      await importItems(r.owner.token, [
        { key: 'tibs' },
        { key: 'shiro' },
        { key: 'shiro' },
        { key: 'tea' },
      ])
    );
    expect(first.created.map((i) => i.name)).toEqual(['Shiro', 'Tea']);
    expect(first.skipped).toEqual([
      { key: 'tibs', reason: 'ALREADY_ADDED' }, // same name as the existing "Tibs"
      { key: 'shiro', reason: 'ALREADY_ADDED' }, // twice in one request
    ]);

    const again = body<{ created: Item[]; skipped: unknown[] }>(
      await importItems(r.owner.token, [{ key: 'shiro' }, { key: 'tea' }])
    );
    expect(again.created).toEqual([]);
    expect(again.skipped).toHaveLength(2);
    expect(await app.prisma.menuItem.count({ where: { businessId: r.businessId } })).toBe(5);
  });

  it('two imports at the same moment never duplicate', async () => {
    const items = [{ key: 'genfo' }, { key: 'ful' }, { key: 'chips' }];
    const results = await Promise.all([
      importItems(r.owner.token, items),
      importItems(r.manager.token, items),
    ]);
    expect(results.map((x) => x.statusCode)).toEqual([200, 200]);
    expect(
      await app.prisma.menuItem.count({
        where: { businessId: r.businessId, catalogKey: { not: null } },
      })
    ).toBe(3);
  });

  it('an unknown key fails the whole request; max 100 items', async () => {
    const before = await app.prisma.menuItem.count();
    const res = await importItems(r.owner.token, [{ key: 'doro-wat' }, { key: 'not-a-dish' }]);
    expect(res.statusCode).toBe(400);
    expect(code(res)).toBe('VALIDATION_ERROR');
    expect(await app.prisma.menuItem.count()).toBe(before);

    const hundred = Array.from({ length: 100 }, (_, i) => ({
      key: CATALOG[i % CATALOG.length]!.key,
    }));
    expect(code(await importItems(r.owner.token, [...hundred, { key: 'tea' }]))).toBe(
      'VALIDATION_ERROR'
    );
    const ok = body<{ created: Item[]; skipped: unknown[] }>(
      await importItems(r.owner.token, hundred)
    );
    expect(ok.created.length + ok.skipped.length).toBe(100);
    // Everything except Tibs and Coffee (already on the menu) was added once.
    expect(ok.created).toHaveLength(CATALOG.length - 2);

    expect(code(await importItems(r.owner.token, [{ key: 'tea', priceEtb: 0 }]))).toBe(
      'VALIDATION_ERROR'
    );
    expect(code(await importItems(r.owner.token, [{ key: 'tea', name: 'x'.repeat(61) }]))).toBe(
      'VALIDATION_ERROR'
    );
  });
});

describe('manual add, edit and delete', () => {
  it('duplicate names (ignoring case and spaces) -> MENU_DUPLICATE; price rules', async () => {
    for (const name of ['tibs', '  TIBS ', 'Ti bs']) {
      expect(
        code(await call('POST', '/menu', r.owner.token, { name, category: 'food', priceEtb: 100 })),
        name
      ).toBe('MENU_DUPLICATE');
    }
    for (const priceEtb of [0, 12.5, 1_000_001]) {
      expect(
        code(
          await call('POST', '/menu', r.owner.token, { name: 'Tea', category: 'drinks', priceEtb })
        )
      ).toBe('VALIDATION_ERROR');
    }
    const tea = await call('POST', '/menu', r.owner.token, {
      name: 'Tea',
      nameAm: 'ሻይ',
      category: 'drinks',
      priceEtb: 1_000_000,
    });
    expect(tea.statusCode).toBe(201);
    expect(body<Item>(tea)).toMatchObject({ nameAm: 'ሻይ', sortOrder: 1 });

    expect(
      code(await call('PATCH', `/menu/${body<Item>(tea).id}`, r.owner.token, { name: 'coffee' }))
    ).toBe('MENU_DUPLICATE');
    const moved = await call('PATCH', `/menu/${body<Item>(tea).id}`, r.owner.token, {
      sortOrder: 0,
      nameAm: null,
    });
    expect(body<Item>(moved)).toMatchObject({ sortOrder: 0, nameAm: null });
  });

  it('delete is soft: hidden, cannot be ordered, name can be reused', async () => {
    expect((await call('DELETE', `/menu/${r.menu.tibs.id}`, r.manager.token)).statusCode).toBe(204);
    expect((await menuOf(r.owner.token)).map((i) => i.name)).not.toContain('Tibs');
    const row = await app.prisma.menuItem.findUniqueOrThrow({ where: { id: r.menu.tibs.id } });
    expect(row.deletedAt).not.toBeNull();
    expect(row.active).toBe(false);

    expect(
      code(await call('PATCH', `/menu/${r.menu.tibs.id}`, r.owner.token, { active: true }))
    ).toBe('NOT_FOUND');
    expect(code(await call('DELETE', `/menu/${r.menu.tibs.id}`, r.owner.token))).toBe('NOT_FOUND');
    const order = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers: headers(r.waiter.token, newKey()),
      payload: {
        type: 'takeaway',
        customerName: 'Abel',
        items: [{ menuItemId: r.menu.tibs.id, quantity: 1 }],
      },
    });
    expect(code(order)).toBe('ITEM_UNAVAILABLE');

    const again = await call('POST', '/menu', r.owner.token, {
      name: 'Tibs',
      category: 'food',
      priceEtb: 500,
    });
    expect(again.statusCode).toBe(201);
    // And the catalog entry can be imported again.
    expect(body<CatalogEntry[]>(await catalog(r.owner.token, '?q=kitfo'))[0]?.alreadyAdded).toBe(
      false
    );
  });
});

describe('bulk edits', () => {
  it('bulk-price: exact prices; an unknown id or too-high price changes nothing', async () => {
    const ok = await call('POST', '/menu/bulk-price', r.owner.token, {
      updates: [
        { id: r.menu.tibs.id, priceEtb: 500 },
        { id: r.menu.coffee.id, priceEtb: 65 },
      ],
    });
    expect(ok.statusCode).toBe(200);
    expect(
      body<Item[]>(ok)
        .map((i) => [i.name, i.priceEtb])
        .sort()
    ).toEqual([
      ['Coffee', 65],
      ['Tibs', 500],
    ]);

    const bad = await call('POST', '/menu/bulk-price', r.owner.token, {
      updates: [
        { id: r.menu.tibs.id, priceEtb: 1 },
        { id: 'does-not-exist', priceEtb: 1 },
      ],
    });
    expect(code(bad)).toBe('NOT_FOUND');
    const tooHigh = await call('POST', '/menu/bulk-price', r.owner.token, {
      ids: [r.menu.tibs.id, r.menu.coffee.id],
      percent: 200,
    });
    expect(tooHigh.statusCode).toBe(200); // 1,500 and 195 are fine
    await app.prisma.menuItem.update({
      where: { id: r.menu.coffee.id },
      data: { priceEtb: 400_000 },
    });
    expect(
      code(
        await call('POST', '/menu/bulk-price', r.owner.token, {
          ids: [r.menu.tibs.id, r.menu.coffee.id],
          percent: 200,
        })
      )
    ).toBe('VALIDATION_ERROR');
    const tibs = await app.prisma.menuItem.findUniqueOrThrow({ where: { id: r.menu.tibs.id } });
    expect(tibs.priceEtb).toBe(1500); // unchanged by the two failed requests

    expect(
      code(
        await call('POST', '/menu/bulk-price', r.owner.token, {
          ids: [r.menu.tibs.id],
          percent: 201,
        })
      )
    ).toBe('VALIDATION_ERROR');
    expect(
      code(
        await call('POST', '/menu/bulk-price', r.owner.token, {
          updates: [
            { id: r.menu.tibs.id, priceEtb: 5 },
            { id: r.menu.tibs.id, priceEtb: 6 },
          ],
        })
      )
    ).toBe('VALIDATION_ERROR');
  });

  it('bulk-price percent rounds to 5 ETB; existing orders keep their prices', async () => {
    const order = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers: headers(r.waiter.token, newKey()),
      payload: {
        type: 'takeaway',
        customerName: 'Abel',
        items: [{ menuItemId: r.menu.coffee.id, quantity: 2 }],
      },
    });
    expect(order.statusCode).toBe(201);

    const res = await call('POST', '/menu/bulk-price', r.manager.token, {
      ids: [r.menu.tibs.id, r.menu.coffee.id],
      percent: 7,
    });
    expect(
      body<Item[]>(res)
        .map((i) => [i.name, i.priceEtb])
        .sort()
    ).toEqual([
      ['Coffee', 65],
      ['Tibs', 480],
    ]); // 64.2, 481.5

    const line = await app.prisma.orderItem.findFirstOrThrow({
      where: { menuItemId: r.menu.coffee.id },
    });
    expect(line.priceEtb).toBe(60);
    const bill = await app.prisma.bill.findFirstOrThrow({ where: { businessId: r.businessId } });
    expect(bill.foodTotalEtb).toBe(120);
  });

  it('bulk-availability turns items off for waiters; an unknown id changes nothing', async () => {
    const off = await call('POST', '/menu/bulk-availability', r.owner.token, {
      ids: [r.menu.tibs.id, r.menu.coffee.id],
      active: false,
    });
    expect(body<Item[]>(off).every((i) => !i.active)).toBe(true);
    expect(await menuOf(r.waiter.token)).toEqual([]);

    const bad = await call('POST', '/menu/bulk-availability', r.owner.token, {
      ids: [r.menu.tibs.id, 'nope'],
      active: true,
    });
    expect(code(bad)).toBe('NOT_FOUND');
    expect(await menuOf(r.waiter.token)).toEqual([]);
  });
});

describe('roles, plan and isolation', () => {
  it('waiter and chef cannot write or use the catalog', async () => {
    for (const token of [r.waiter.token, r.chef.token]) {
      const attempts = [
        await call('POST', '/menu', token, { name: 'X', category: 'food', priceEtb: 1 }),
        await call('PATCH', `/menu/${r.menu.tibs.id}`, token, { priceEtb: 1 }),
        await call('DELETE', `/menu/${r.menu.tibs.id}`, token),
        await call('POST', '/menu/bulk-price', token, { ids: [r.menu.tibs.id], percent: 10 }),
        await call('POST', '/menu/bulk-availability', token, {
          ids: [r.menu.tibs.id],
          active: false,
        }),
        await catalog(token),
        await importItems(token, [{ key: 'tea' }]),
      ];
      expect(attempts.map(code)).toEqual(Array(7).fill('FORBIDDEN'));
    }
    expect((await menuOf(r.waiter.token)).map((i) => i.name).sort()).toEqual(['Coffee', 'Tibs']);
  });

  it('normal plan -> SUBSCRIPTION_REQUIRED; another business cannot touch this menu', async () => {
    const normal = await createRestaurant(app, 'normal');
    expect(code(await catalog(normal.owner.token))).toBe('SUBSCRIPTION_REQUIRED');
    expect(code(await importItems(normal.owner.token, [{ key: 'tea' }]))).toBe(
      'SUBSCRIPTION_REQUIRED'
    );

    const other = await createRestaurant(app);
    const ids = [r.menu.tibs.id];
    expect(
      code(await call('PATCH', `/menu/${r.menu.tibs.id}`, other.owner.token, { priceEtb: 1 }))
    ).toBe('NOT_FOUND');
    expect(code(await call('DELETE', `/menu/${r.menu.tibs.id}`, other.owner.token))).toBe(
      'NOT_FOUND'
    );
    expect(
      code(await call('POST', '/menu/bulk-price', other.owner.token, { ids, percent: 10 }))
    ).toBe('NOT_FOUND');
    expect(
      code(await call('POST', '/menu/bulk-availability', other.owner.token, { ids, active: false }))
    ).toBe('NOT_FOUND');

    // Importing in one business does not mark the catalog as added in the other.
    await importItems(r.owner.token, [{ key: 'kitfo' }]);
    expect(
      body<CatalogEntry[]>(await catalog(other.owner.token, '?q=kitfo'))[0]?.alreadyAdded
    ).toBe(false);
    const tibs = await app.prisma.menuItem.findUniqueOrThrow({ where: { id: r.menu.tibs.id } });
    expect(tibs.priceEtb).toBe(450);
  });
});
