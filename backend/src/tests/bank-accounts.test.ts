import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  addStaff,
  bearer,
  createTestApp,
  registerOwner,
  resetDatabase,
  signIn,
  type TestApp,
} from './helpers.js';

let app: TestApp;

beforeAll(async () => {
  app = await createTestApp();
});
afterAll(async () => {
  await app.close();
});
beforeEach(async () => {
  await resetDatabase(app);
});

const add = (token: string, accountNumber: string, bankCode = 'CBE') =>
  app.inject({
    method: 'POST',
    url: '/api/v1/bank-accounts',
    headers: bearer(token),
    payload: { bankCode, accountNumber },
  });

describe('bank accounts', () => {
  it('adds and lists accounts without exposing the full account number', async () => {
    const owner = await registerOwner(app);
    const res = await add(owner.token, '1000293884582');
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      bankCode: 'CBE',
      bankName: 'Commercial Bank of Ethiopia',
      last4: '4582',
    });

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/bank-accounts',
      headers: bearer(owner.token),
    });
    expect(list.json()).toHaveLength(1);
    expect(list.body).not.toContain('1000293884582');
  });

  it('rejects a duplicate active account', async () => {
    const owner = await registerOwner(app);
    await add(owner.token, '1000293884582');
    const dup = await add(owner.token, '1000293884582');
    expect(dup.statusCode).toBe(409);
    expect(dup.json()).toEqual({ error: { code: 'ACCOUNT_DUPLICATE' } });
  });

  it('allows at most six connected accounts; removing one frees a slot and keeps history', async () => {
    const owner = await registerOwner(app);
    const ids: string[] = [];
    for (let i = 0; i < 6; i++) ids.push((await add(owner.token, `100000000000${i}`)).json().id);

    const seventh = await add(owner.token, '1000000000009');
    expect(seventh.json()).toEqual({ error: { code: 'ACCOUNT_LIMIT' } });

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/bank-accounts/${ids[0]}`,
      headers: bearer(owner.token),
    });
    expect(del.statusCode).toBe(204);
    const removed = await app.prisma.bankAccount.findUniqueOrThrow({ where: { id: ids[0]! } });
    expect(removed.removedAt).not.toBeNull();

    expect((await add(owner.token, '1000000000009')).statusCode).toBe(201);
  });

  it('waiters can list but not add accounts', async () => {
    const owner = await registerOwner(app);
    const { payload } = await addStaff(app, owner.token, { role: 'waiter', pin: '1111' });
    const waiterToken = (await signIn(app, payload.phone, '1111')).json().token;
    expect((await add(waiterToken, '1000293884582')).statusCode).toBe(403);
    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/bank-accounts',
      headers: bearer(waiterToken),
    });
    expect(list.statusCode).toBe(200);
  });

  it('rejects unknown banks and malformed account numbers', async () => {
    const owner = await registerOwner(app);
    expect((await add(owner.token, '1000293884582', 'XYZ')).json().error.code).toBe(
      'VALIDATION_ERROR'
    );
    expect((await add(owner.token, '12345')).json().error.code).toBe('VALIDATION_ERROR');
  });
});
