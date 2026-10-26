import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createRestaurant,
  createTestApp,
  headers,
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

const call = (
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  token: string,
  body?: object
) => app.inject({ method, url: `/api/v1${url}`, headers: headers(token), payload: body });
const json = <T>(res: { json: () => unknown }) => res.json() as T;
const code = (res: { json: () => unknown }) =>
  (res.json() as { error?: { code?: string } }).error?.code;
const turnOn = (body: object) => call('PATCH', '/business/features', r.owner.token, body);

describe('owner extras: switches', () => {
  it('both are off at first; every member reads them; only the owner changes them', async () => {
    for (const token of [r.owner.token, r.manager.token, r.waiter.token, r.chef.token]) {
      expect(json(await call('GET', '/business/features', token))).toEqual({
        featureBuyList: false,
        featureMoneyOut: false,
      });
    }
    for (const token of [r.manager.token, r.waiter.token, r.chef.token]) {
      const res = await call('PATCH', '/business/features', token, { featureBuyList: true });
      expect(code(res)).toBe('FORBIDDEN');
    }
    const on = await turnOn({ featureBuyList: true });
    expect(json(on)).toEqual({ featureBuyList: true, featureMoneyOut: false });
    expect((await turnOn({})).statusCode).toBe(400);
  });
});

describe('owner extras: a feature that is off answers 403', () => {
  it('buy list and money out routes refuse everyone, owner included, until switched on', async () => {
    const attempts: [string, string, string, object?][] = [
      ['GET', '/buy-items', r.owner.token],
      ['POST', '/buy-items', r.chef.token, { name: 'Onions', when: 'TODAY' }],
      ['GET', '/spendings', r.owner.token],
      [
        'POST',
        '/spendings',
        r.manager.token,
        { title: 'Taxi', amount: 50, category: 'TRANSPORT', paidFrom: 'CASH' },
      ],
    ];
    for (const [method, url, token, body] of attempts) {
      const res = await call(method as 'GET', url, token, body);
      expect(res.statusCode).toBe(403);
      expect(res.json()).toMatchObject({
        error: { code: 'FORBIDDEN', details: { reason: 'FEATURE_OFF' } },
      });
    }

    // Switching one on opens only that one.
    await turnOn({ featureBuyList: true });
    expect((await call('GET', '/buy-items', r.owner.token)).statusCode).toBe(200);
    expect((await call('GET', '/spendings', r.owner.token)).statusCode).toBe(403);
  });

  it('turning a feature off hides it but keeps its data', async () => {
    await turnOn({ featureBuyList: true });
    await call('POST', '/buy-items', r.chef.token, { name: 'Onions', qty: '3 kg', when: 'TODAY' });
    await turnOn({ featureBuyList: false });
    expect((await call('GET', '/buy-items', r.owner.token)).statusCode).toBe(403);
    expect(await app.prisma.buyItem.count({ where: { businessId: r.businessId } })).toBe(1);
    await turnOn({ featureBuyList: true });
    expect(json<unknown[]>(await call('GET', '/buy-items', r.owner.token))).toHaveLength(1);
  });
});

describe('owner extras: buy list and money out', () => {
  it('chef lists, manager buys; a spending is added only when money out is on', async () => {
    await turnOn({ featureBuyList: true });
    const add = (name: string) =>
      call('POST', '/buy-items', r.chef.token, { name, qty: '2 boxes', when: 'WEEK' });
    const first = json<{ id: string }>(await add('Tomatoes'));
    const second = json<{ id: string }>(await add('Oil'));

    // Roles: waiters see nothing; a manager cannot add; a chef cannot mark bought.
    expect((await call('GET', '/buy-items', r.waiter.token)).statusCode).toBe(403);
    expect(
      (await call('POST', '/buy-items', r.manager.token, { name: 'X', when: 'TODAY' })).statusCode
    ).toBe(403);
    expect(
      (
        await call('POST', `/buy-items/${first.id}/bought`, r.chef.token, {
          price: 90,
          paidFrom: 'CASH',
        })
      ).statusCode
    ).toBe(403);

    // Bought with money out off: no spending.
    const bought = await call('POST', `/buy-items/${first.id}/bought`, r.manager.token, {
      price: 90,
      paidFrom: 'CASH',
    });
    expect(json(bought)).toMatchObject({ status: 'BOUGHT', price: 90, paidFrom: 'CASH' });
    expect(await app.prisma.spending.count()).toBe(0);
    // Again: already bought.
    const again = await call('POST', `/buy-items/${first.id}/bought`, r.manager.token, {
      price: 90,
      paidFrom: 'CASH',
    });
    expect(code(again)).toBe('CONFLICT');

    // With money out on, buying adds a spending linked to the item.
    await turnOn({ featureMoneyOut: true });
    await call('POST', `/buy-items/${second.id}/bought`, r.owner.token, {
      price: 250,
      paidFrom: 'BANK',
    });
    const spendings = await app.prisma.spending.findMany();
    expect(spendings).toHaveLength(1);
    expect(spendings[0]).toMatchObject({ amount: 250, paidFrom: 'BANK', buyItemId: second.id });

    const open = json<unknown[]>(await call('GET', '/buy-items?status=OPEN', r.manager.token));
    expect(open).toHaveLength(0);
    expect(
      json<unknown[]>(await call('GET', '/buy-items?status=BOUGHT', r.chef.token))
    ).toHaveLength(2);
  });

  it('a chef removes only their own open items; the owner removes any', async () => {
    await turnOn({ featureBuyList: true });
    const mine = json<{ id: string }>(
      await call('POST', '/buy-items', r.chef.token, { name: 'Salt', when: 'TODAY' })
    );
    const ownersItem = json<{ id: string }>(
      await call('POST', '/buy-items', r.owner.token, { name: 'Sugar', when: 'TODAY' })
    );
    expect((await call('DELETE', `/buy-items/${ownersItem.id}`, r.chef.token)).statusCode).toBe(
      403
    );
    await call('POST', `/buy-items/${mine.id}/bought`, r.manager.token, {
      price: 10,
      paidFrom: 'CASH',
    });
    expect((await call('DELETE', `/buy-items/${mine.id}`, r.chef.token)).statusCode).toBe(403);
    expect((await call('DELETE', `/buy-items/${mine.id}`, r.owner.token)).statusCode).toBe(204);
    expect((await call('DELETE', `/buy-items/${ownersItem.id}`, r.owner.token)).statusCode).toBe(
      204
    );
  });

  it('manager records spending and reads the totals; chefs and waiters cannot', async () => {
    await turnOn({ featureMoneyOut: true });
    const spend = (amount: number, paidFrom: string) =>
      call('POST', '/spendings', r.manager.token, {
        title: 'Charcoal',
        amount,
        category: 'OTHER',
        paidFrom,
      });
    expect((await spend(300, 'CASH')).statusCode).toBe(201);
    expect((await spend(700, 'BANK')).statusCode).toBe(201);
    // An older entry counts for the week but not for today.
    await app.prisma.spending.create({
      data: {
        businessId: r.businessId,
        title: 'Rent part',
        amount: 1000,
        category: 'BILLS',
        paidFrom: 'CASH',
        createdById: r.manager.memberId,
        createdAt: new Date(Date.now() - 3 * 86_400_000),
      },
    });

    const res = json<{ entries: unknown[]; totals: object }>(
      await call('GET', '/spendings', r.manager.token)
    );
    expect(res.entries).toHaveLength(2);
    expect(res.totals).toEqual({ today: 1000, week: 2000, cash: 300, bank: 700 });

    for (const token of [r.chef.token, r.waiter.token]) {
      expect((await call('GET', '/spendings', token)).statusCode).toBe(403);
    }
    for (const bad of [
      { amount: 0 },
      { amount: 1.5 },
      { title: '' },
      { paidFrom: 'CARD' },
      { category: 'X' },
    ]) {
      const body = { title: 'T', amount: 5, category: 'OTHER', paidFrom: 'CASH', ...bad };
      expect((await call('POST', '/spendings', r.manager.token, body)).statusCode).toBe(400);
    }
  });

  it('another business sees none of it', async () => {
    await turnOn({ featureBuyList: true, featureMoneyOut: true });
    await call('POST', '/buy-items', r.chef.token, { name: 'Salt', when: 'TODAY' });
    const other = await createRestaurant(app);
    await call('PATCH', '/business/features', other.owner.token, {
      featureBuyList: true,
      featureMoneyOut: true,
    });
    expect(json<unknown[]>(await call('GET', '/buy-items', other.owner.token))).toHaveLength(0);
  });
});
