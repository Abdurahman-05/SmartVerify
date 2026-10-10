import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { CATALOG_ITEMS } from '../modules/menu/catalog/index.js';

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
  // Menu: Tibs 450 (food), Coffee 60 (drinks), Old dish 100 (food, off). "Tibs" and "Coffee"
  // are also starter-pack names, so they count as already added.
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
  groupName: string | null;
  active: boolean;
  sortOrder: number;
}
interface Imported {
  created: Item[];
  skipped: { key: string; reason: string }[];
  totalCreated: number;
}
interface Pack {
  key: string;
  itemCount: number;
  addedCount: number;
  groups: { key: string; category: string; itemCount: number; addedCount: number }[];
}
interface CatalogItem {
  key: string;
  packKey: string;
  groupKey: string;
  category: string;
  alreadyAdded: boolean;
}

const importBody = async (token: string, payload: object) =>
  body<Imported>(await call('POST', '/menu/catalog/import', token, payload));
const menuOf = async (token: string) => body<Item[]>(await call('GET', '/menu', token));
const packsOf = async (token: string) =>
  body<Pack[]>(await call('GET', '/menu/catalog/packs', token));
const itemsOf = (pack: string) => CATALOG_ITEMS.filter((i) => i.packKey === pack);

describe('packs and catalog', () => {
  it('lists packs with counts; addedCount follows the menu', async () => {
    const before = await packsOf(r.owner.token);
    expect(before.map((p) => p.key)).toEqual([
      'ethiopian-traditional',
      'ethiopian-everyday',
      'ethiopian-fasting',
      'arab-mandi',
      'pizza-burger',
      'cafe-bakery',
      'drinks',
    ]);
    const traditional = before.find((p) => p.key === 'ethiopian-traditional')!;
    expect(traditional.itemCount).toBe(itemsOf('ethiopian-traditional').length);
    expect(traditional.addedCount).toBe(1); // "Tibs"
    expect(traditional.groups.find((g) => g.key === 'meat-tibs')).toMatchObject({
      category: 'food',
      addedCount: 1,
    });
    expect(before.find((p) => p.key === 'cafe-bakery')?.addedCount).toBe(1); // "Coffee"

    await importBody(r.owner.token, { packs: ['ethiopian-fasting'] });
    const after = await packsOf(r.manager.token);
    const fasting = after.find((p) => p.key === 'ethiopian-fasting')!;
    expect(fasting.addedCount).toBe(fasting.itemCount);
    expect(fasting.groups.every((g) => g.addedCount === g.itemCount)).toBe(true);
  });

  it('filters items by pack, group, category and English or Amharic search', async () => {
    const get = async (query: string) =>
      body<CatalogItem[]>(await call('GET', `/menu/catalog${query}`, r.owner.token));

    expect((await get('?pack=drinks')).length).toBe(itemsOf('drinks').length);
    expect((await get('?pack=arab-mandi&group=desserts')).map((i) => i.key)).toEqual([
      'kunafa',
      'basbousa',
      'baklava',
      'umm-ali',
    ]);
    expect((await get('?category=combos')).every((i) => i.category === 'combos')).toBe(true);
    expect((await get('?q=MANDI')).map((i) => i.key).sort()).toEqual(
      [
        'beef-mandi',
        'chicken-mandi',
        'fish-mandi',
        'lamb-mandi',
        'mandi-family-tray',
        'mandi-for-2',
      ].sort()
    );
    expect((await get(`?q=${encodeURIComponent('ሽሮ')}`)).map((i) => i.key).sort()).toEqual(
      ['shiro', 'shiro-fasting', 'shiro-tegabino'].sort()
    );
    const all = await get('');
    const flag = (key: string) => all.find((i) => i.key === key)?.alreadyAdded;
    expect([flag('tibs'), flag('coffee'), flag('kitfo')]).toEqual([true, true, false]);
  });
});

describe('POST /menu/catalog/import', () => {
  it('whole pack: suggested prices, sections, appended; importing twice skips everything', async () => {
    const res = await importBody(r.owner.token, { packs: ['ethiopian-fasting'] });
    const fasting = itemsOf('ethiopian-fasting');
    expect(res.totalCreated).toBe(fasting.length);
    expect(res.skipped).toEqual([]);
    const shiro = res.created.find((i) => i.name === 'Shiro Fasting');
    expect(shiro).toMatchObject({
      nameAm: 'የጾም ሽሮ',
      priceEtb: 150,
      category: 'food',
      groupName: 'Fasting Food',
      active: true,
    });
    expect(res.created.find((i) => i.name === 'Fasting Platter for 2')).toMatchObject({
      category: 'combos',
      groupName: 'Combos',
    });
    // Food already had sortOrder 0 items, so the first imported food item comes after them.
    expect(
      Math.min(...res.created.filter((i) => i.category === 'food').map((i) => i.sortOrder))
    ).toBe(1);

    const again = await importBody(r.owner.token, { packs: ['ethiopian-fasting'] });
    expect(again.totalCreated).toBe(0);
    expect(again.skipped).toHaveLength(fasting.length);
    expect(again.skipped.every((s) => s.reason === 'ALREADY_ADDED')).toBe(true);
  });

  it('whole group, single item with custom price and name, and pack overrides', async () => {
    const res = await importBody(r.owner.token, {
      groups: [{ pack: 'arab-mandi', group: 'desserts' }],
      items: [{ key: 'kitfo', priceEtb: 620, name: '  House Kitfo ' }],
    });
    expect(res.created.map((i) => i.name).sort()).toEqual([
      'Baklava',
      'Basbousa',
      'House Kitfo',
      'Kunafa',
      'Umm Ali',
    ]);
    expect(res.created.find((i) => i.name === 'House Kitfo')).toMatchObject({
      priceEtb: 620,
      nameAm: 'ክትፎ',
      groupName: 'Raw & Kitfo',
    });
    expect(
      await app.prisma.menuItem.findFirst({
        where: { name: 'House Kitfo' },
        select: { catalogKey: true },
      })
    ).toEqual({
      catalogKey: 'kitfo',
    });

    // A pack with one item excluded and one item's price set.
    const drinks = await importBody(r.owner.token, {
      packs: ['drinks'],
      items: [{ key: 'pepsi', priceEtb: 55 }],
      exclude: ['energy-drink'],
    });
    expect(drinks.totalCreated).toBe(itemsOf('drinks').length - 1);
    expect(drinks.created.map((i) => i.name)).not.toContain('Energy Drink');
    expect(drinks.created.find((i) => i.name === 'Pepsi')?.priceEtb).toBe(55);
  });

  it('activate=false adds items turned off; bulk-availability turns them on', async () => {
    const res = await importBody(r.owner.token, {
      groups: [{ pack: 'drinks', group: 'water' }],
      activate: false,
    });
    expect(res.created.every((i) => !i.active)).toBe(true);
    expect((await menuOf(r.waiter.token)).map((i) => i.name).sort()).toEqual(['Coffee', 'Tibs']);

    const on = await call('POST', '/menu/bulk-availability', r.manager.token, {
      ids: res.created.map((i) => i.id),
      active: true,
    });
    expect(body<Item[]>(on).every((i) => i.active)).toBe(true);
    expect((await menuOf(r.waiter.token)).length).toBe(2 + res.created.length);
  });

  it('every pack at once: all items except the two already on the menu', async () => {
    const res = await importBody(r.owner.token, {
      packs: [
        'ethiopian-traditional',
        'ethiopian-everyday',
        'ethiopian-fasting',
        'arab-mandi',
        'pizza-burger',
        'cafe-bakery',
        'drinks',
      ],
    });
    expect(res.totalCreated).toBe(CATALOG_ITEMS.length - 2);
    expect(res.skipped.map((s) => s.key).sort()).toEqual(['coffee', 'tibs']);
  });

  it('unknown pack, group or key fails everything; selection must be 1..300 items', async () => {
    const before = await app.prisma.menuItem.count();
    for (const payload of [
      { packs: ['drinks', 'no-such-pack'] },
      { packs: ['drinks'], groups: [{ pack: 'drinks', group: 'beer-garden' }] },
      { packs: ['drinks'], items: [{ key: 'not-a-dish' }] },
      { packs: ['drinks'], exclude: ['not-a-dish'] },
      {
        groups: [{ pack: 'drinks', group: 'water' }],
        exclude: ['ambo-sparkling-water', 'mineral-water', 'water-small', 'water-large'],
      }, // 0 left
      {},
      { items: Array.from({ length: 301 }, () => ({ key: 'tea' })) },
    ]) {
      const res = await call('POST', '/menu/catalog/import', r.owner.token, payload);
      expect(res.statusCode, JSON.stringify(payload).slice(0, 80)).toBe(400);
      expect(code(res)).toBe('VALIDATION_ERROR');
    }
    expect(await app.prisma.menuItem.count()).toBe(before);
  });

  it('two imports at the same moment never duplicate', async () => {
    const payload = { groups: [{ pack: 'arab-mandi', group: 'desserts' }] };
    const [a, b] = await Promise.all([
      call('POST', '/menu/catalog/import', r.owner.token, payload),
      call('POST', '/menu/catalog/import', r.manager.token, payload),
    ]);
    expect([a.statusCode, b.statusCode]).toEqual([200, 200]);
    expect(
      await app.prisma.menuItem.count({
        where: { businessId: r.businessId, groupName: 'Desserts' },
      })
    ).toBe(4);
  });
});

describe('price editing', () => {
  it('bulk-price exact prices: all or nothing', async () => {
    const ok = await call('POST', '/menu/bulk-price', r.owner.token, {
      updates: [
        { id: r.menu.tibs.id, priceEtb: 500 },
        { id: r.menu.coffee.id, priceEtb: 65 },
      ],
    });
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
    expect(
      (await app.prisma.menuItem.findUniqueOrThrow({ where: { id: r.menu.tibs.id } })).priceEtb
    ).toBe(500);
  });

  it('bulk-price percent (rounded to 5) by ids and by section; existing orders keep prices', async () => {
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

    const byIds = await call('POST', '/menu/bulk-price', r.manager.token, {
      ids: [r.menu.tibs.id, r.menu.coffee.id],
      percent: 7,
    });
    expect(
      body<Item[]>(byIds)
        .map((i) => [i.name, i.priceEtb])
        .sort()
    ).toEqual([
      ['Coffee', 65],
      ['Tibs', 480],
    ]);
    expect(
      (await app.prisma.orderItem.findFirstOrThrow({ where: { menuItemId: r.menu.coffee.id } }))
        .priceEtb
    ).toBe(60);

    await importBody(r.owner.token, { groups: [{ pack: 'drinks', group: 'soft-drinks' }] });
    const section = await call('POST', '/menu/bulk-price', r.owner.token, {
      groupName: 'Soft Drinks',
      category: 'drinks',
      percent: 10,
    });
    const prices = Object.fromEntries(body<Item[]>(section).map((i) => [i.name, i.priceEtb]));
    expect(prices).toEqual({
      'Coca-Cola': 55,
      Pepsi: 55,
      Fanta: 55,
      Sprite: 55,
      Mirinda: 55,
      'Energy Drink': 130,
    });

    expect(
      code(
        await call('POST', '/menu/bulk-price', r.owner.token, {
          groupName: 'No Such Section',
          percent: 10,
        })
      )
    ).toBe('NOT_FOUND');
    expect(
      code(
        await call('POST', '/menu/bulk-price', r.owner.token, {
          ids: [r.menu.tibs.id],
          percent: 250,
        })
      )
    ).toBe('VALIDATION_ERROR');
  });

  it('manual add: duplicate name -> MENU_DUPLICATE; groupName is kept', async () => {
    expect(
      code(
        await call('POST', '/menu', r.owner.token, {
          name: ' TI BS',
          category: 'food',
          priceEtb: 100,
        })
      )
    ).toBe('MENU_DUPLICATE');
    const res = await call('POST', '/menu', r.owner.token, {
      name: 'Ayib',
      category: 'food',
      priceEtb: 120,
      groupName: 'Sides',
    });
    expect(res.statusCode).toBe(201);
    expect(body<Item>(res)).toMatchObject({ name: 'Ayib', groupName: 'Sides' });
    for (const priceEtb of [0, 12.5, 1_000_001]) {
      expect(
        code(
          await call('POST', '/menu', r.owner.token, { name: 'Tea', category: 'drinks', priceEtb })
        )
      ).toBe('VALIDATION_ERROR');
    }
  });

  it('bulk-delete is soft and all or nothing', async () => {
    const bad = await call('POST', '/menu/bulk-delete', r.owner.token, {
      ids: [r.menu.tibs.id, 'nope'],
    });
    expect(code(bad)).toBe('NOT_FOUND');
    expect((await menuOf(r.owner.token)).length).toBe(3);

    const ok = await call('POST', '/menu/bulk-delete', r.owner.token, {
      ids: [r.menu.tibs.id, r.menu.coffee.id],
    });
    expect(body<{ deleted: number }>(ok)).toEqual({ deleted: 2 });
    expect((await menuOf(r.owner.token)).map((i) => i.name)).toEqual(['Old dish']);
    expect(
      await app.prisma.menuItem.count({
        where: { businessId: r.businessId, deletedAt: { not: null } },
      })
    ).toBe(2);
  });
});

describe('roles, plan and isolation', () => {
  it('waiter and chef cannot use the catalog or write', async () => {
    for (const token of [r.waiter.token, r.chef.token]) {
      const attempts = [
        await call('GET', '/menu/catalog/packs', token),
        await call('GET', '/menu/catalog', token),
        await call('POST', '/menu/catalog/import', token, { packs: ['drinks'] }),
        await call('POST', '/menu', token, { name: 'X', category: 'food', priceEtb: 1 }),
        await call('PATCH', `/menu/${r.menu.tibs.id}`, token, { priceEtb: 1 }),
        await call('DELETE', `/menu/${r.menu.tibs.id}`, token),
        await call('POST', '/menu/bulk-price', token, { ids: [r.menu.tibs.id], percent: 10 }),
        await call('POST', '/menu/bulk-availability', token, {
          ids: [r.menu.tibs.id],
          active: false,
        }),
        await call('POST', '/menu/bulk-delete', token, { ids: [r.menu.tibs.id] }),
      ];
      expect(attempts.map(code)).toEqual(Array(9).fill('FORBIDDEN'));
    }
    expect((await menuOf(r.waiter.token)).map((i) => i.name).sort()).toEqual(['Coffee', 'Tibs']);
  });

  it('normal plan -> SUBSCRIPTION_REQUIRED; another business cannot touch this menu', async () => {
    const normal = await createRestaurant(app, 'normal');
    expect(code(await call('GET', '/menu/catalog/packs', normal.owner.token))).toBe(
      'SUBSCRIPTION_REQUIRED'
    );
    expect(
      code(await call('POST', '/menu/catalog/import', normal.owner.token, { packs: ['drinks'] }))
    ).toBe('SUBSCRIPTION_REQUIRED');

    const other = await createRestaurant(app);
    const ids = [r.menu.tibs.id];
    expect(
      code(await call('POST', '/menu/bulk-price', other.owner.token, { ids, percent: 10 }))
    ).toBe('NOT_FOUND');
    expect(code(await call('POST', '/menu/bulk-delete', other.owner.token, { ids }))).toBe(
      'NOT_FOUND'
    );
    expect(
      code(await call('POST', '/menu/bulk-availability', other.owner.token, { ids, active: false }))
    ).toBe('NOT_FOUND');

    // A section price change in one business does not touch the other's items.
    await importBody(r.owner.token, { groups: [{ pack: 'arab-mandi', group: 'desserts' }] });
    await importBody(other.owner.token, { groups: [{ pack: 'arab-mandi', group: 'desserts' }] });
    await call('POST', '/menu/bulk-price', other.owner.token, {
      groupName: 'Desserts',
      percent: 100,
    });
    const kunafa = await app.prisma.menuItem.findFirstOrThrow({
      where: { businessId: r.businessId, name: 'Kunafa' },
    });
    expect(kunafa.priceEtb).toBe(350);

    const otherPacks = await packsOf(other.owner.token);
    expect(otherPacks.find((p) => p.key === 'arab-mandi')?.addedCount).toBe(4);
    expect(
      (await app.prisma.menuItem.findUniqueOrThrow({ where: { id: r.menu.tibs.id } })).priceEtb
    ).toBe(450);
  });
});
