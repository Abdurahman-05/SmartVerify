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

type Res = { statusCode: number; json: () => unknown };
const code = (res: Res) => (res.json() as { error?: { code?: string } }).error?.code;
const call = (method: 'GET' | 'POST' | 'DELETE', url: string, token: string, payload?: object) =>
  app.inject({
    method,
    url: `/api/v1${url}`,
    headers: headers(token),
    ...(payload && { payload }),
  });
const add = (token: string, body: object) => call('POST', '/bank-accounts', token, body);

interface Account {
  id: string;
  bankCode: string;
  bankName: string;
  shortName: string;
  last4: string;
  holderName: string;
}

describe('bank accounts', () => {
  it('lists the supported banks', async () => {
    const banks = (await call('GET', '/banks', r.waiter.token)).json() as { code: string }[];
    expect(banks.length).toBeGreaterThanOrEqual(11);
    expect(banks[0]).toEqual({
      code: 'CBE',
      name: 'Commercial Bank of Ethiopia',
      shortName: 'CBE',
    });
  });

  it('adds accounts showing only the last 4 digits; empty holder name shows the business name', async () => {
    const res = await add(r.owner.token, {
      bankCode: 'CBE',
      accountNumber: '1000293884582',
      holderName: 'Abebe K.',
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      bankCode: 'CBE',
      bankName: 'Commercial Bank of Ethiopia',
      shortName: 'CBE',
      last4: '4582',
      holderName: 'Abebe K.',
    });
    expect(JSON.stringify(res.json())).not.toContain('1000293884582');

    const tele = (
      await add(r.manager.token, { bankCode: 'TEL', accountNumber: '0911227788' })
    ).json() as Account;
    expect(tele).toMatchObject({ shortName: 'Telebirr', last4: '7788', holderName: 'Test Cafe' });

    const list = (await call('GET', '/bank-accounts', r.waiter.token)).json() as Account[];
    expect(list.map((a) => a.shortName)).toEqual(['CBE', 'Telebirr']);
  });

  it('refuses duplicates, a 7th account, bad numbers, unknown banks and waiters', async () => {
    await add(r.owner.token, { bankCode: 'CBE', accountNumber: '1000293884582' });
    expect(
      code(await add(r.owner.token, { bankCode: 'CBE', accountNumber: '1000293884582' }))
    ).toBe('ACCOUNT_DUPLICATE');
    // Same number at another bank is a different account.
    expect(
      (await add(r.owner.token, { bankCode: 'AWA', accountNumber: '1000293884582' })).statusCode
    ).toBe(201);

    expect(
      (await add(r.owner.token, { bankCode: 'TEL', accountNumber: '0912345678' })).statusCode
    ).toBe(201);
    for (const n of ['1000000001', '1000000002', '1000000003']) {
      expect((await add(r.owner.token, { bankCode: 'DAS', accountNumber: n })).statusCode).toBe(
        201
      );
    }
    expect(code(await add(r.owner.token, { bankCode: 'BOA', accountNumber: '2000000001' }))).toBe(
      'ACCOUNT_LIMIT'
    );

    for (const body of [
      { bankCode: 'CBE', accountNumber: '12345' },
      { bankCode: 'CBE', accountNumber: '12345678901234' },
      { bankCode: 'CBE', accountNumber: '10002938845ab' },
      { bankCode: 'XYZ', accountNumber: '1000293884582' },
      // Telebirr takes the wallet phone number, not an account number.
      { bankCode: 'TEL', accountNumber: '1000293884582' },
      { bankCode: 'TEL', accountNumber: '0812345678' },
    ]) {
      expect(code(await add(r.manager.token, body)), JSON.stringify(body)).toBe('VALIDATION_ERROR');
    }
    expect(code(await add(r.waiter.token, { bankCode: 'CBE', accountNumber: '3000000001' }))).toBe(
      'FORBIDDEN'
    );
  });

  it('remove is soft: it leaves the list, frees a place and can be added again', async () => {
    const acc = (
      await add(r.owner.token, { bankCode: 'CBE', accountNumber: '1000293884582' })
    ).json() as Account;
    expect((await call('DELETE', `/bank-accounts/${acc.id}`, r.owner.token)).statusCode).toBe(204);
    expect((await call('GET', '/bank-accounts', r.owner.token)).json()).toEqual([]);
    expect(
      await app.prisma.bankAccount.count({ where: { id: acc.id, removedAt: { not: null } } })
    ).toBe(1);
    expect(code(await call('DELETE', `/bank-accounts/${acc.id}`, r.owner.token))).toBe('NOT_FOUND');
    expect(
      (await add(r.owner.token, { bankCode: 'CBE', accountNumber: '1000293884582' })).statusCode
    ).toBe(201);
    expect(code(await call('DELETE', `/bank-accounts/${acc.id}`, r.waiter.token))).toBe(
      'FORBIDDEN'
    );
  });

  it('other businesses cannot see or remove the accounts; works on the Normal plan', async () => {
    const acc = (
      await add(r.owner.token, { bankCode: 'CBE', accountNumber: '1000293884582' })
    ).json() as Account;
    const other = await createRestaurant(app, 'normal');
    expect((await call('GET', '/bank-accounts', other.owner.token)).json()).toEqual([]);
    expect(code(await call('DELETE', `/bank-accounts/${acc.id}`, other.owner.token))).toBe(
      'NOT_FOUND'
    );
    // The same account number can be connected by another business.
    expect(
      (await add(other.owner.token, { bankCode: 'CBE', accountNumber: '1000293884582' })).statusCode
    ).toBe(201);
  });
});
