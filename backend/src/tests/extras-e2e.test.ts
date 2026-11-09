import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createRestaurant,
  createTestApp,
  headers,
  resetDatabase,
  type Restaurant,
  type TestApp,
} from './helpers.js';

/**
 * End to end: one working day of the buy list and expenses, through the API, with every role.
 * Soft checks, so one run lists every step that does not work.
 */
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

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
const call = (method: Method, url: string, token: string, body?: object) =>
  app.inject({ method, url: `/api/v1${url}`, headers: headers(token), payload: body });
const json = <T>(res: { json: () => unknown }) => res.json() as T;
const status = async (method: Method, url: string, token: string, body?: object) =>
  (await call(method, url, token, body)).statusCode;

interface BuyItem {
  id: string;
  status: string;
  price: number | null;
  createdBy: string;
  boughtBy: string | null;
}
interface Spending {
  id: string;
  amount: number;
  isNew: boolean;
  deletedAt: string | null;
  oldAmount: number | null;
  buyItemId: string | null;
  isCost: boolean;
}
interface SpendingList {
  entries: Spending[];
  totals: { today: number; week: number; cash: number; bank: number };
  newCount: number;
}
const notes = (memberId: string, type: string) =>
  app.prisma.notification.count({ where: { memberId, type } });

describe('buy list + expenses, end to end, every role', () => {
  it('switches: everything is off at first; only the owner turns it on', async () => {
    for (const who of [r.owner, r.manager, r.chef, r.waiter]) {
      expect.soft(await status('GET', '/buy-items', who.token), 'buy list off').toBe(403);
      expect.soft(await status('GET', '/spendings', who.token), 'expenses off').toBe(403);
    }
    for (const who of [r.manager, r.chef, r.waiter]) {
      expect
        .soft(await status('PATCH', '/business/features', who.token, { featureBuyList: true }))
        .toBe(403);
    }
    const on = await call('PATCH', '/business/features', r.owner.token, {
      featureBuyList: true,
      featureMoneyOut: true,
    });
    expect.soft(json(on)).toEqual({ featureBuyList: true, featureMoneyOut: true });
    // Every member reads the switches (the app shows or hides the screens with them).
    for (const who of [r.manager, r.chef, r.waiter]) {
      expect
        .soft(json(await call('GET', '/business/features', who.token)))
        .toEqual({ featureBuyList: true, featureMoneyOut: true });
    }
  });

  it('a full day: chef asks, manager buys, expenses, owner checks, corrects and deletes', async () => {
    await call('PATCH', '/business/features', r.owner.token, {
      featureBuyList: true,
      featureMoneyOut: true,
    });

    // ── Chef and owner add to the buy list; manager and waiter cannot.
    const tomatoes = json<BuyItem>(
      await call('POST', '/buy-items', r.chef.token, {
        name: 'Tomatoes',
        qty: '5 kg',
        when: 'TODAY',
      })
    );
    const onions = json<BuyItem>(
      await call('POST', '/buy-items', r.chef.token, { name: 'Onions', when: 'WEEK' })
    );
    const oil = json<BuyItem>(
      await call('POST', '/buy-items', r.owner.token, { name: 'Oil', qty: '2 L', when: 'TODAY' })
    );
    expect.soft(tomatoes.status).toBe('OPEN');
    expect.soft(tomatoes.createdBy).toBe('Chef Hana');
    expect
      .soft(await status('POST', '/buy-items', r.manager.token, { name: 'X', when: 'TODAY' }))
      .toBe(403);
    expect
      .soft(await status('POST', '/buy-items', r.waiter.token, { name: 'X', when: 'TODAY' }))
      .toBe(403);
    // Bad input is refused.
    expect
      .soft(await status('POST', '/buy-items', r.chef.token, { name: '', when: 'TODAY' }))
      .toBe(400);

    // ── Who can see the list.
    for (const who of [r.owner, r.manager, r.chef]) {
      expect.soft(json<unknown[]>(await call('GET', '/buy-items', who.token))).toHaveLength(3);
    }
    expect.soft(await status('GET', '/buy-items', r.waiter.token)).toBe(403);

    // ── Only manager / owner mark bought.
    for (const who of [r.chef, r.waiter]) {
      expect
        .soft(
          await status('POST', `/buy-items/${tomatoes.id}/bought`, who.token, {
            price: 300,
            paidFrom: 'CASH',
          })
        )
        .toBe(403);
    }
    const bought = json<BuyItem>(
      await call('POST', `/buy-items/${tomatoes.id}/bought`, r.manager.token, {
        price: 300,
        paidFrom: 'CASH',
      })
    );
    expect.soft(bought).toMatchObject({ status: 'BOUGHT', price: 300, boughtBy: 'Manager Yonas' });
    // Twice: refused.
    expect
      .soft(
        await status('POST', `/buy-items/${tomatoes.id}/bought`, r.owner.token, {
          price: 300,
          paidFrom: 'CASH',
        })
      )
      .toBe(409);
    // Price 0 or negative: refused.
    expect
      .soft(
        await status('POST', `/buy-items/${oil.id}/bought`, r.owner.token, {
          price: 0,
          paidFrom: 'CASH',
        })
      )
      .toBe(400);
    // Buying added an expense, and the owner was told.
    expect.soft(await notes(r.owner.memberId, 'new_expense')).toBe(1);

    // ── Chef removes only their own open items.
    expect.soft(await status('DELETE', `/buy-items/${oil.id}`, r.chef.token)).toBe(403);
    expect.soft(await status('DELETE', `/buy-items/${tomatoes.id}`, r.chef.token)).toBe(403);
    expect.soft(await status('DELETE', `/buy-items/${onions.id}`, r.chef.token)).toBe(204);

    // ── Manager records an expense; chef and waiter cannot.
    const gas = json<Spending>(
      await call('POST', '/spendings', r.manager.token, {
        title: 'Gas cylinder',
        amount: 1200,
        category: 'GAS',
        paidFrom: 'BANK',
      })
    );
    expect.soft(gas.isNew).toBe(true);
    for (const who of [r.chef, r.waiter]) {
      expect
        .soft(
          await status('POST', '/spendings', who.token, {
            title: 'X',
            amount: 10,
            category: 'OTHER',
            paidFrom: 'CASH',
          })
        )
        .toBe(403);
      expect.soft(await status('GET', '/spendings', who.token)).toBe(403);
    }
    // The owner's own expense is never "new".
    const salary = json<Spending>(
      await call('POST', '/spendings', r.owner.token, {
        title: 'Cleaner',
        amount: 500,
        category: 'SALARY',
        paidFrom: 'CASH',
      })
    );
    expect.soft(salary.isNew).toBe(false);
    expect.soft(await notes(r.owner.memberId, 'new_expense')).toBe(2);

    // ── Totals: tomatoes 300 cash + gas 1200 bank + cleaner 500 cash.
    let list = json<SpendingList>(await call('GET', '/spendings', r.manager.token));
    expect.soft(list.entries).toHaveLength(3);
    expect.soft(list.totals).toMatchObject({ today: 2000, cash: 800, bank: 1200 });
    expect.soft(list.newCount).toBe(2);

    // ── Owner checks one, corrects one; manager cannot do either.
    const tomatoSpend = list.entries.find((e) => e.buyItemId === tomatoes.id);
    expect.soft(tomatoSpend, 'expense from the buy list').toBeTruthy();
    expect.soft(await status('POST', `/spendings/${gas.id}/review`, r.manager.token)).toBe(403);
    expect
      .soft(await status('PATCH', `/spendings/${gas.id}`, r.manager.token, { amount: 1 }))
      .toBe(403);
    expect
      .soft(json<Spending>(await call('POST', `/spendings/${gas.id}/review`, r.owner.token)).isNew)
      .toBe(false);
    const fixed = json<Spending>(
      await call('PATCH', `/spendings/${tomatoSpend!.id}`, r.owner.token, { amount: 280 })
    );
    expect.soft(fixed).toMatchObject({ amount: 280, oldAmount: 300, isNew: false });
    // The buy list should show the corrected price too.
    const tomatoRow = json<BuyItem[]>(await call('GET', '/buy-items', r.owner.token)).find(
      (b) => b.id === tomatoes.id
    );
    expect.soft(tomatoRow?.price, 'buy list price after the owner corrected it').toBe(280);

    // ── Owner deletes the gas with a reason: listed, crossed out, not counted; manager told.
    expect
      .soft(await status('POST', `/spendings/${gas.id}/delete`, r.manager.token, { reason: 'x' }))
      .toBe(403);
    const gone = json<Spending>(
      await call('POST', `/spendings/${gas.id}/delete`, r.owner.token, { reason: 'Wrong amount' })
    );
    expect.soft(gone.deletedAt).not.toBeNull();
    expect.soft(await notes(r.manager.memberId, 'expense_deleted')).toBe(1);
    expect
      .soft(await status('PATCH', `/spendings/${gas.id}`, r.owner.token, { amount: 5 }))
      .toBe(409);
    list = json<SpendingList>(await call('GET', '/spendings', r.owner.token));
    expect.soft(list.entries).toHaveLength(3);
    expect.soft(list.totals).toMatchObject({ today: 780, cash: 780, bank: 0 });

    // ── Money flow: owner yes; manager only with the reports permission; others no.
    const flow = json<{ expenses: { total: number } }>(
      await call('GET', '/money-flow?period=today', r.owner.token)
    );
    expect.soft(flow.expenses.total).toBe(780);
    expect.soft(await status('GET', '/money-flow?period=today', r.manager.token)).toBe(403);
    for (const who of [r.chef, r.waiter]) {
      expect.soft(await status('GET', '/money-flow?period=today', who.token)).toBe(403);
    }
    // The owner's "Reports for managers" switch opens it for managers (same rule as Reports).
    await call('PUT', '/business/report-access', r.owner.token, { managerCanSeeReports: true });
    expect.soft(await status('GET', '/money-flow?period=today', r.manager.token)).toBe(200);

    // ── Owner removes the bought tomatoes from the buy list: the money was still spent, so the
    // expense must stay (crossed out at most), never vanish without a trace.
    expect.soft(await status('DELETE', `/buy-items/${tomatoes.id}`, r.owner.token)).toBe(204);
    const afterRemove = json<SpendingList>(await call('GET', '/spendings', r.owner.token));
    expect
      .soft(
        afterRemove.entries.some((e) => e.id === tomatoSpend!.id),
        'expense of a removed bought item is still in the list'
      )
      .toBe(true);
  });

  it('money out off: buying adds no expense and expense routes refuse; buy list keeps working', async () => {
    await call('PATCH', '/business/features', r.owner.token, { featureBuyList: true });
    const item = json<BuyItem>(
      await call('POST', '/buy-items', r.chef.token, { name: 'Salt', when: 'WEEK' })
    );
    expect
      .soft(
        await status('POST', `/buy-items/${item.id}/bought`, r.manager.token, {
          price: 40,
          paidFrom: 'CASH',
        })
      )
      .toBe(200);
    expect.soft(await app.prisma.spending.count()).toBe(0);
    expect.soft(await status('GET', '/spendings', r.owner.token)).toBe(403);
  });

  it('another business and the Normal plan cannot reach any of it', async () => {
    await call('PATCH', '/business/features', r.owner.token, {
      featureBuyList: true,
      featureMoneyOut: true,
    });
    const item = json<BuyItem>(
      await call('POST', '/buy-items', r.chef.token, { name: 'Rice', when: 'TODAY' })
    );
    const other = await createRestaurant(app);
    await call('PATCH', '/business/features', other.owner.token, { featureBuyList: true });
    expect
      .soft(json<unknown[]>(await call('GET', '/buy-items', other.owner.token)))
      .toHaveLength(0);
    expect
      .soft(
        await status('POST', `/buy-items/${item.id}/bought`, other.owner.token, {
          price: 10,
          paidFrom: 'CASH',
        })
      )
      .toBe(404);
    expect.soft(await status('DELETE', `/buy-items/${item.id}`, other.owner.token)).toBe(404);

    const normal = await createRestaurant(app, 'normal');
    expect.soft(await status('GET', '/buy-items', normal.owner.token)).toBe(402);
  });
});
