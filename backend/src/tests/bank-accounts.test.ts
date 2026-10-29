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
      await add(r.manager.token, {
        bankCode: 'TEL',
        accountNumber: '0911227788',
        holderName: 'Abebe Kebede',
      })
    ).json() as Account;
    expect(tele).toMatchObject({
      shortName: 'Telebirr',
      last4: '7788',
      holderName: 'Abebe Kebede',
    });

    const list = (await call('GET', '/bank-accounts', r.waiter.token)).json() as Account[];
    expect(list.map((a) => a.shortName)).toEqual(['CBE', 'Telebirr']);
  });

  it('refuses duplicates, a 7th account, bad numbers, unknown banks and waiters', async () => {
    await add(r.owner.token, {
      bankCode: 'CBE',
      accountNumber: '1000293884582',
      holderName: 'Abebe Kebede',
    });
    expect(
      code(
        await add(r.owner.token, {
          bankCode: 'CBE',
          accountNumber: '1000293884582',
          holderName: 'Abebe Kebede',
        })
      )
    ).toBe('ACCOUNT_DUPLICATE');
    // Same number at another bank is a different account.
    expect(
      (await add(r.owner.token, { bankCode: 'AWA', accountNumber: '1000293884582' })).statusCode
    ).toBe(201);

    expect(
      (
        await add(r.owner.token, {
          bankCode: 'TEL',
          accountNumber: '0912345678',
          holderName: 'Abebe Kebede',
        })
      ).statusCode
    ).toBe(201);
    // Abyssinia accounts can be 9 digits.
    for (const n of ['100000001', '1000000002', '1000000003']) {
      expect(
        (
          await add(r.owner.token, {
            bankCode: 'DAS',
            accountNumber: n,
            holderName: 'Abebe Kebede',
          })
        ).statusCode
      ).toBe(201);
    }
    expect(
      code(
        await add(r.owner.token, {
          bankCode: 'BOA',
          accountNumber: '2000000001',
          holderName: 'Abebe Kebede',
        })
      )
    ).toBe('ACCOUNT_LIMIT');

    for (const body of [
      { bankCode: 'CBE', accountNumber: '12345' },
      // CBE needs the holder name: payment checks compare it with the receipt.
      { bankCode: 'CBE', accountNumber: '1000293884599' },
      { bankCode: 'CBE', accountNumber: '12345678901234567' },
      { bankCode: 'BOA', accountNumber: '1234567' },
      { bankCode: 'CBE', accountNumber: '10002938845ab' },
      { bankCode: 'XYZ', accountNumber: '1000293884582' },
      // Telebirr takes the wallet phone number, not an account number.
      { bankCode: 'TEL', accountNumber: '1000293884582' },
      { bankCode: 'TEL', accountNumber: '0812345678' },
    ]) {
      expect(code(await add(r.manager.token, body)), JSON.stringify(body)).toBe('VALIDATION_ERROR');
    }
    expect(
      code(
        await add(r.waiter.token, {
          bankCode: 'CBE',
          accountNumber: '3000000001',
          holderName: 'Abebe Kebede',
        })
      )
    ).toBe('FORBIDDEN');
  });

  it('edits the holder name and number; refuses a duplicate, a bad phone, waiters and others', async () => {
    const cbe = (
      await add(r.owner.token, {
        bankCode: 'CBE',
        accountNumber: '1000293884582',
        holderName: 'Abebe Kebede',
      })
    ).json() as Account;
    const tele = (
      await add(r.owner.token, {
        bankCode: 'TEL',
        accountNumber: '0911227788',
        holderName: 'Abebe Kebede',
      })
    ).json() as Account;

    const named = await call('PATCH', `/bank-accounts/${cbe.id}`, r.manager.token, {
      holderName: 'Abebe Kebede Coffee',
    });
    expect(named.statusCode).toBe(200);
    expect(named.json()).toMatchObject({ last4: '4582', holderName: 'Abebe Kebede Coffee' });

    const renumbered = await call('PATCH', `/bank-accounts/${cbe.id}`, r.owner.token, {
      accountNumber: '1000111122223',
    });
    expect(renumbered.json()).toMatchObject({ bankCode: 'CBE', last4: '2223' });
    expect(JSON.stringify(renumbered.json())).not.toContain('1000111122223');
    expect(
      (await app.prisma.bankAccount.findUnique({ where: { id: cbe.id } }))?.accountNumber
    ).toBe('1000111122223');

    const other = (
      await add(r.owner.token, {
        bankCode: 'CBE',
        accountNumber: '1000293884582',
        holderName: 'Abebe Kebede',
      })
    ).json() as Account;
    expect(
      code(
        await call('PATCH', `/bank-accounts/${other.id}`, r.owner.token, {
          accountNumber: '1000111122223',
        })
      )
    ).toBe('ACCOUNT_DUPLICATE');
    expect(
      code(
        await call('PATCH', `/bank-accounts/${tele.id}`, r.owner.token, {
          accountNumber: '1234567890',
        })
      )
    ).toBe('VALIDATION_ERROR');
    expect(
      code(await call('PATCH', `/bank-accounts/${cbe.id}`, r.waiter.token, { holderName: 'X Y' }))
    ).toBe('FORBIDDEN');

    const stranger = await createRestaurant(app);
    expect(
      code(
        await call('PATCH', `/bank-accounts/${cbe.id}`, stranger.owner.token, {
          holderName: 'X Y',
        })
      )
    ).toBe('NOT_FOUND');
  });

  it('remove is soft: it leaves the list, frees a place and can be added again', async () => {
    const acc = (
      await add(r.owner.token, {
        bankCode: 'CBE',
        accountNumber: '1000293884582',
        holderName: 'Abebe Kebede',
      })
    ).json() as Account;
    expect((await call('DELETE', `/bank-accounts/${acc.id}`, r.owner.token)).statusCode).toBe(204);
    expect((await call('GET', '/bank-accounts', r.owner.token)).json()).toEqual([]);
    expect(
      await app.prisma.bankAccount.count({ where: { id: acc.id, removedAt: { not: null } } })
    ).toBe(1);
    expect(code(await call('DELETE', `/bank-accounts/${acc.id}`, r.owner.token))).toBe('NOT_FOUND');
    expect(
      (
        await add(r.owner.token, {
          bankCode: 'CBE',
          accountNumber: '1000293884582',
          holderName: 'Abebe Kebede',
        })
      ).statusCode
    ).toBe(201);
    expect(code(await call('DELETE', `/bank-accounts/${acc.id}`, r.waiter.token))).toBe(
      'FORBIDDEN'
    );
  });

  it('other businesses cannot see or remove the accounts; works on the Normal plan', async () => {
    const acc = (
      await add(r.owner.token, {
        bankCode: 'CBE',
        accountNumber: '1000293884582',
        holderName: 'Abebe Kebede',
      })
    ).json() as Account;
    const other = await createRestaurant(app, 'normal');
    expect((await call('GET', '/bank-accounts', other.owner.token)).json()).toEqual([]);
    expect(code(await call('DELETE', `/bank-accounts/${acc.id}`, other.owner.token))).toBe(
      'NOT_FOUND'
    );
    // The same account number can be connected by another business.
    expect(
      (
        await add(other.owner.token, {
          bankCode: 'CBE',
          accountNumber: '1000293884582',
          holderName: 'Abebe Kebede',
        })
      ).statusCode
    ).toBe(201);
  });
});
