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

interface Category {
  id: string;
  name: string;
  nameAm: string | null;
  kind: string;
  sortOrder: number;
  itemCount: number;
}
interface Item {
  id: string;
  name: string;
  category: string;
  categoryId: string;
  categoryName: string;
}

const call = (
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  token: string,
  body?: object
) =>
  app.inject({
    method,
    url: `/api/v1${url}`,
    headers: headers(token, method === 'POST' ? newKey() : undefined),
    payload: body,
  });
const categories = async (token = r.owner.token) =>
  (await call('GET', '/menu/categories', token)).json() as Category[];
const code = (res: { json: () => unknown }) =>
  (res.json() as { error?: { code?: string } }).error?.code;

describe('menu categories', () => {
  it('everyone reads the categories, with how many items each has', async () => {
    for (const token of [r.owner.token, r.manager.token, r.waiter.token, r.chef.token]) {
      const list = await categories(token);
      expect(list.map((c) => [c.name, c.itemCount])).toEqual([
        ['Food', 2],
        ['Drinks', 1],
      ]);
    }
  });

  it('a business without categories gets Food, Drinks and Combos', async () => {
    await app.prisma.menuItem.deleteMany({ where: { businessId: r.businessId } });
    await app.prisma.itemCategory.deleteMany({ where: { businessId: r.businessId } });
    const list = await categories();
    expect(list.map((c) => c.name)).toEqual(['Food', 'Drinks', 'Combos']);
    expect(list[0]).toMatchObject({ nameAm: 'ምግብ', kind: 'food', itemCount: 0 });
  });

  it('owner and manager add, rename and delete categories; waiters and chefs cannot', async () => {
    const hot = await call('POST', '/menu/categories', r.manager.token, {
      name: ' Hot drinks ',
      nameAm: 'ትኩስ መጠጥ',
    });
    expect(hot.statusCode).toBe(201);
    expect(hot.json()).toMatchObject({ name: 'Hot drinks', nameAm: 'ትኩስ መጠጥ', itemCount: 0 });
    const id = (hot.json() as Category).id;

    // New categories go to the end.
    expect((await categories()).map((c) => c.name)).toEqual(['Food', 'Drinks', 'Hot drinks']);

    const renamed = await call('PATCH', `/menu/categories/${id}`, r.owner.token, { name: 'Tea' });
    expect(renamed.json()).toMatchObject({ name: 'Tea', nameAm: 'ትኩስ መጠጥ' });
    const cleared = await call('PATCH', `/menu/categories/${id}`, r.owner.token, { nameAm: null });
    expect(cleared.json()).toMatchObject({ nameAm: null });

    for (const token of [r.waiter.token, r.chef.token]) {
      const add = await call('POST', '/menu/categories', token, { name: 'Fast food' });
      expect(add.statusCode).toBe(403);
      const edit = await call('PATCH', `/menu/categories/${id}`, token, { name: 'X' });
      expect(edit.statusCode).toBe(403);
      expect((await call('DELETE', `/menu/categories/${id}`, token)).statusCode).toBe(403);
    }

    expect((await call('DELETE', `/menu/categories/${id}`, r.owner.token)).statusCode).toBe(204);
    expect((await categories()).map((c) => c.name)).toEqual(['Food', 'Drinks']);
    expect((await call('DELETE', `/menu/categories/${id}`, r.owner.token)).statusCode).toBe(404);
  });

  it('a used name (ignoring case and spaces) is refused; a deleted name can be reused', async () => {
    const dup = await call('POST', '/menu/categories', r.owner.token, { name: ' dRINKs ' });
    expect(dup.statusCode).toBe(409);
    expect(code(dup)).toBe('CATEGORY_DUPLICATE');

    const made = await call('POST', '/menu/categories', r.owner.token, { name: 'Fast food' });
    const fast = made.json() as Category;
    const clash = await call('PATCH', `/menu/categories/${fast.id}`, r.owner.token, {
      name: 'food',
    });
    expect(code(clash)).toBe('CATEGORY_DUPLICATE');

    await call('DELETE', `/menu/categories/${fast.id}`, r.owner.token);
    const again = await call('POST', '/menu/categories', r.owner.token, { name: 'Fast food' });
    expect(again.statusCode).toBe(201);
  });

  it('a category with items cannot be deleted until they are moved or deleted', async () => {
    const [food] = await categories();
    const blocked = await call('DELETE', `/menu/categories/${food!.id}`, r.owner.token);
    expect(blocked.statusCode).toBe(409);
    expect(code(blocked)).toBe('CATEGORY_NOT_EMPTY');

    const made = await call('POST', '/menu/categories', r.owner.token, { name: 'Combo' });
    const combo = made.json() as Category;
    for (const item of [r.menu.tibs, r.menu.retired]) {
      const moved = await call('PATCH', `/menu/${item.id}`, r.owner.token, {
        categoryId: combo.id,
      });
      expect(moved.json()).toMatchObject({ categoryId: combo.id, categoryName: 'Combo' });
    }
    const gone = await call('DELETE', `/menu/categories/${food!.id}`, r.owner.token);
    expect(gone.statusCode).toBe(204);
  });

  it('items are added into the chosen category and listed in the owner’s order', async () => {
    const made = await call('POST', '/menu/categories', r.owner.token, { name: 'Hot drinks' });
    const hot = made.json() as Category;
    const tea = await call('POST', '/menu', r.manager.token, {
      name: 'Tea',
      priceEtb: 30,
      categoryId: hot.id,
    });
    expect(tea.statusCode).toBe(201);
    expect(tea.json()).toMatchObject({
      categoryId: hot.id,
      categoryName: 'Hot drinks',
      category: 'food',
    });

    // Without a categoryId, the first category of the kind is used.
    const juice = await call('POST', '/menu', r.manager.token, {
      name: 'Juice',
      priceEtb: 50,
      category: 'drinks',
    });
    expect(juice.json()).toMatchObject({ categoryName: 'Drinks', category: 'drinks' });

    const menu = (await call('GET', '/menu', r.manager.token)).json() as Item[];
    expect(menu.map((i) => i.categoryName)).toEqual([
      'Food',
      'Food',
      'Drinks',
      'Drinks',
      'Hot drinks',
    ]);
  });

  it('a category of another business or an unknown one cannot be used', async () => {
    const other = await createRestaurant(app);
    const [theirs] = await categories(other.owner.token);
    const stolen = await call('POST', '/menu', r.owner.token, {
      name: 'Ghost',
      priceEtb: 1,
      categoryId: theirs!.id,
    });
    expect(stolen.statusCode).toBe(404);
    const rename = await call('PATCH', `/menu/categories/${theirs!.id}`, r.owner.token, {
      name: 'Mine now',
    });
    expect(rename.statusCode).toBe(404);
    const unknown = await call('POST', '/menu', r.owner.token, {
      name: 'Ghost',
      priceEtb: 1,
      categoryId: 'nope',
    });
    expect(unknown.statusCode).toBe(404);
  });

  it('starter packs add into the first category of their kind', async () => {
    await call('POST', '/menu/categories', r.owner.token, { name: 'Zzz', kind: 'drinks' });
    const imported = await call('POST', '/menu/catalog/import', r.owner.token, {
      packs: ['drinks'],
    });
    expect(imported.statusCode).toBe(200);
    const created = (imported.json() as { created: Item[] }).created;
    expect(created.length).toBeGreaterThan(0);
    const drinks = (await categories()).find((c) => c.name === 'Drinks')!;
    expect(
      created.filter((i) => i.category === 'drinks').every((i) => i.categoryId === drinks.id)
    ).toBe(true);
  });
});
