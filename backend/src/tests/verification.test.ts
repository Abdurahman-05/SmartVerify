import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ScriptedTestProvider } from './fixtures/test-verification-provider.js';
import { bearer, createTestApp, registerOwner, resetDatabase, type TestApp } from './helpers.js';

let plain: TestApp;
let withProvider: TestApp;
const provider = new ScriptedTestProvider();

beforeAll(async () => {
  plain = await createTestApp();
  withProvider = await createTestApp({ providers: [provider] });
});
afterAll(async () => {
  await plain.close();
  await withProvider.close();
});
beforeEach(async () => {
  await resetDatabase(plain);
});

async function ownerWithAccounts(app: TestApp) {
  const owner = await registerOwner(app);
  const cbe = (
    await app.inject({
      method: 'POST',
      url: '/api/v1/bank-accounts',
      headers: bearer(owner.token),
      payload: { bankCode: 'CBE', accountNumber: '1000293884582', holderName: 'Test Cafe' },
    })
  ).json();
  const tel = (
    await app.inject({
      method: 'POST',
      url: '/api/v1/bank-accounts',
      headers: bearer(owner.token),
      payload: { bankCode: 'TEL', accountNumber: '0911227788' },
    })
  ).json();
  return { owner, cbe, tel };
}

const verify = (app: TestApp, token: string, body: object) =>
  app.inject({
    method: 'POST',
    url: '/api/v1/verifications',
    headers: bearer(token),
    payload: body,
  });

const transfer = (overrides: object = {}) => ({
  outcome: 'found' as const,
  transfer: {
    bankCode: 'CBE',
    reference: 'FT0001',
    receiverAccountNumber: '1000293884582',
    payerName: 'Customer',
    amount: 1000,
    ...overrides,
  },
});

describe('verification without a provider (production default)', () => {
  it('never claims a payment is verified', async () => {
    const { owner } = await ownerWithAccounts(plain);
    const res = await verify(plain, owner.token, {
      expectedAmount: 1000,
      input: { type: 'qr', raw: 'anything' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'unable_to_verify', reason: 'NO_PROVIDER' });
    expect(await plain.prisma.transaction.count()).toBe(0);
    expect(
      await plain.prisma.verificationAttempt.count({ where: { status: 'unable_to_verify' } })
    ).toBe(1);
  });
});

describe('verification service rules (test provider)', () => {
  it('verifies an exact payment and records one transaction', async () => {
    const { owner, cbe } = await ownerWithAccounts(withProvider);
    provider.next = transfer();
    const res = await verify(withProvider, owner.token, {
      expectedAmount: 1000,
      input: { type: 'qr', raw: 'TEST:1' },
    });
    expect(res.json()).toMatchObject({
      status: 'verified',
      amount: 1000,
      accountId: cbe.id,
      reference: 'FT0001',
    });
    expect(await withProvider.prisma.transaction.count({ where: { status: 'verified' } })).toBe(1);
  });

  it('checks all connected accounts, not only the one the user picked', async () => {
    const { owner, cbe, tel } = await ownerWithAccounts(withProvider);
    provider.next = transfer();
    const res = await verify(withProvider, owner.token, {
      expectedAmount: 1000,
      accountId: tel.id,
      input: { type: 'qr', raw: 'TEST:2' },
    });
    expect(res.json()).toMatchObject({ status: 'verified', accountId: cbe.id });
  });

  it('flags a reused reference as duplicate', async () => {
    const { owner } = await ownerWithAccounts(withProvider);
    provider.next = transfer({ reference: 'FT-DUP' });
    await verify(withProvider, owner.token, {
      expectedAmount: 1000,
      input: { type: 'qr', raw: 'TEST:3' },
    });
    const second = await verify(withProvider, owner.token, {
      expectedAmount: 1000,
      input: { type: 'qr', raw: 'TEST:3' },
    });
    expect(second.json()).toMatchObject({
      status: 'failed',
      reason: 'duplicate',
      reference: 'FT-DUP',
    });
    expect(await withProvider.prisma.transaction.count({ where: { status: 'verified' } })).toBe(1);
  });

  it('reports an amount mismatch and a payment into an unknown account', async () => {
    const { owner } = await ownerWithAccounts(withProvider);
    provider.next = transfer({ reference: 'FT-LOW', amount: 900 });
    const low = await verify(withProvider, owner.token, {
      expectedAmount: 1000,
      input: { type: 'qr', raw: 'TEST:4' },
    });
    expect(low.json()).toMatchObject({
      status: 'failed',
      reason: 'amountMismatch',
      expectedAmount: 1000,
      paidAmount: 900,
    });

    provider.next = transfer({ reference: 'FT-ELSE', receiverAccountNumber: '9999999999' });
    const elsewhere = await verify(withProvider, owner.token, {
      expectedAmount: 1000,
      input: { type: 'qr', raw: 'TEST:5' },
    });
    expect(elsewhere.json()).toEqual({ status: 'failed', reason: 'wrongAccount' });
  });

  it('rejects a reused Idempotency-Key instead of recording twice', async () => {
    const { owner } = await ownerWithAccounts(withProvider);
    provider.next = transfer({ reference: 'FT-IDEM' });
    const send = () =>
      withProvider.inject({
        method: 'POST',
        url: '/api/v1/verifications',
        headers: { ...bearer(owner.token), 'idempotency-key': 'abc-123' },
        payload: { expectedAmount: 1000, input: { type: 'qr', raw: 'TEST:6' } },
      });
    expect((await send()).statusCode).toBe(200);
    const again = await send();
    expect(again.statusCode).toBe(409);
    expect(await withProvider.prisma.verificationAttempt.count()).toBe(1);
  });
});
