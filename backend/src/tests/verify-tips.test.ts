import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { recordCheck } from '../modules/verification/record-check.js';
import type { VerifyResponse } from '../modules/verification/verification.schemas.js';
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
  r = await createRestaurant(app, 'normal');
});

const paid = (memberId: string, reference: string, expected: number, received: number) =>
  recordCheck(app.prisma, {
    businessId: r.businessId,
    memberId,
    bankCode: 'CBE',
    expectedAmountEtb: expected,
    result: {
      status: 'verified',
      reference,
      amountEtb: received,
      extraEtb: received - expected,
      payerName: 'Kebede Alemu',
      receiverName: 'Test Cafe',
      date: new Date().toISOString(),
    } as VerifyResponse,
  });

const tip = (token: string, reference: string, tipEtb: number) =>
  app.inject({
    method: 'POST',
    url: '/api/v1/verify/tip',
    headers: headers(token),
    payload: { bankCode: 'CBE', reference, tipEtb },
  });

const tips = async (token: string) =>
  (
    await app.inject({ method: 'GET', url: '/api/v1/verify/tips', headers: headers(token) })
  ).json() as { totalEtb: number; byWaiter: { name: string; totalEtb: number }[] };

describe('tips from overpaid receipts (Normal plan, Restaurant app)', () => {
  it('a waiter keeps at most the extra of their own receipt; owner sees everyone', async () => {
    await paid(r.waiter.memberId, 'FT1', 500, 550);
    await paid(r.waiter2.memberId, 'FT2', 300, 320);

    expect((await tip(r.waiter.token, 'FT1', 60)).statusCode).toBe(400);
    expect((await tip(r.waiter2.token, 'FT1', 10)).statusCode).toBe(404);
    expect((await tip(r.waiter.token, 'FT1', 50)).json()).toEqual({ tipEtb: 50 });
    expect((await tip(r.waiter2.token, 'FT2', 20)).statusCode).toBe(200);

    expect(await tips(r.waiter.token)).toMatchObject({
      totalEtb: 50,
      byWaiter: [{ name: 'Waiter Dawit', totalEtb: 50 }],
    });
    expect(await tips(r.owner.token)).toMatchObject({
      totalEtb: 70,
      byWaiter: [
        { name: 'Waiter Dawit', totalEtb: 50 },
        { name: 'Waiter Selam', totalEtb: 20 },
      ],
    });

    // Given back after all: 0 removes the tip.
    await tip(r.waiter.token, 'FT1', 0);
    expect((await tips(r.owner.token)).totalEtb).toBe(20);
  });
});
