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
  sortOrder: number;
  tableCount: number;
}
interface Table {
  id: string;
  number: number;
  categoryId: string;
  categoryName: string;
  busy: boolean;
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
  (await call('GET', '/tables/categories', token)).json() as Category[];
const code = (res: { json: () => unknown }) =>
  (res.json() as { error?: { code?: string } }).error?.code;

describe('table categories', () => {
  it('owner, manager and waiter read the categories with their table counts; chefs cannot', async () => {
    for (const token of [r.owner.token, r.manager.token, r.waiter.token]) {
      const list = await categories(token);
      expect(list.map((c) => [c.name, c.tableCount])).toEqual([['Main Floor', 3]]);
    }
    expect((await call('GET', '/tables/categories', r.chef.token)).statusCode).toBe(403);
  });

  it('a business without categories gets Main Floor, Upstairs and Outside', async () => {
    await app.prisma.restaurantTable.deleteMany({ where: { businessId: r.businessId } });
    await app.prisma.tableCategory.deleteMany({ where: { businessId: r.businessId } });
    const list = await categories();
    expect(list.map((c) => c.name)).toEqual(['Main Floor', 'Upstairs', 'Outside']);
    expect(list[1]).toMatchObject({ nameAm: 'ፎቅ ላይ', tableCount: 0 });
  });

  it('owner and manager add, rename and delete categories; waiters and chefs cannot', async () => {
    const made = await call('POST', '/tables/categories', r.manager.token, {
      name: ' VIP ',
      nameAm: 'ልዩ',
    });
    expect(made.statusCode).toBe(201);
    expect(made.json()).toMatchObject({ name: 'VIP', nameAm: 'ልዩ', tableCount: 0 });
    const id = (made.json() as Category).id;
    expect((await categories()).map((c) => c.name)).toEqual(['Main Floor', 'VIP']);

    const renamed = await call('PATCH', `/tables/categories/${id}`, r.owner.token, {
      name: 'Garden',
    });
    expect(renamed.json()).toMatchObject({ name: 'Garden', nameAm: 'ልዩ' });
    const cleared = await call('PATCH', `/tables/categories/${id}`, r.owner.token, {
      nameAm: null,
    });
    expect(cleared.json()).toMatchObject({ nameAm: null });

    for (const token of [r.waiter.token, r.chef.token]) {
      const add = await call('POST', '/tables/categories', token, { name: 'Roof' });
      expect(add.statusCode).toBe(403);
      const edit = await call('PATCH', `/tables/categories/${id}`, token, { name: 'X' });
      expect(edit.statusCode).toBe(403);
      expect((await call('DELETE', `/tables/categories/${id}`, token)).statusCode).toBe(403);
    }

    expect((await call('DELETE', `/tables/categories/${id}`, r.owner.token)).statusCode).toBe(204);
    expect((await categories()).map((c) => c.name)).toEqual(['Main Floor']);
    expect((await call('DELETE', `/tables/categories/${id}`, r.owner.token)).statusCode).toBe(404);
  });

  it('a used name is refused, ignoring case and spaces; a deleted name can be reused', async () => {
    const dup = await call('POST', '/tables/categories', r.owner.token, { name: ' main  floor ' });
    expect(dup.statusCode).toBe(409);
    expect(code(dup)).toBe('CATEGORY_DUPLICATE');

    const made = await call('POST', '/tables/categories', r.owner.token, { name: 'VIP' });
    const vip = made.json() as Category;
    const clash = await call('PATCH', `/tables/categories/${vip.id}`, r.owner.token, {
      name: 'MAINFLOOR',
    });
    expect(code(clash)).toBe('CATEGORY_DUPLICATE');

    await call('DELETE', `/tables/categories/${vip.id}`, r.owner.token);
    const again = await call('POST', '/tables/categories', r.owner.token, { name: 'VIP' });
    expect(again.statusCode).toBe(201);
  });

  it('tables are added to a chosen category; the same number can exist in two categories', async () => {
    const made = await call('POST', '/tables/categories', r.owner.token, { name: 'VIP' });
    const vip = made.json() as Category;
    const added = await call('POST', '/tables', r.manager.token, {
      categoryId: vip.id,
      numbers: [1, 2],
    });
    expect(added.statusCode).toBe(200);
    const tables = added.json() as Table[];
    // Main Floor has 1, 2, 3 and VIP has 1, 2: number 1 exists in both.
    expect(tables.map((t) => `${t.categoryName} ${t.number}`)).toEqual([
      'Main Floor 1',
      'Main Floor 2',
      'Main Floor 3',
      'VIP 1',
      'VIP 2',
    ]);
    expect((await categories()).map((c) => [c.name, c.tableCount])).toEqual([
      ['Main Floor', 3],
      ['VIP', 2],
    ]);

    // Adding again skips what exists.
    const again = await call('POST', '/tables', r.manager.token, {
      categoryId: vip.id,
      numbers: [2, 3],
    });
    expect((again.json() as Table[]).filter((t) => t.categoryName === 'VIP')).toHaveLength(3);
  });

  it('a category with tables in use cannot be deleted until they are removed', async () => {
    const blocked = await call('DELETE', `/tables/categories/${r.tableCategory.id}`, r.owner.token);
    expect(blocked.statusCode).toBe(409);
    expect(code(blocked)).toBe('CATEGORY_NOT_EMPTY');

    for (const table of r.tables.filter((t) => t.active)) {
      await call('DELETE', `/tables/${table.id}`, r.owner.token);
    }
    const gone = await call('DELETE', `/tables/categories/${r.tableCategory.id}`, r.owner.token);
    expect(gone.statusCode).toBe(204);
  });

  it('another business’s category or an unknown one cannot be used', async () => {
    const other = await createRestaurant(app);
    const theirs = other.tableCategory.id;
    const add = await call('POST', '/tables', r.owner.token, { categoryId: theirs, numbers: [1] });
    expect(add.statusCode).toBe(404);
    const rename = await call('PATCH', `/tables/categories/${theirs}`, r.owner.token, {
      name: 'Mine now',
    });
    expect(rename.statusCode).toBe(404);
    expect((await call('DELETE', `/tables/categories/${theirs}`, r.owner.token)).statusCode).toBe(
      404
    );
    const unknown = await call('POST', '/tables', r.owner.token, {
      categoryId: 'nope',
      numbers: [1],
    });
    expect(unknown.statusCode).toBe(404);
  });
});
