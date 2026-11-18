import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { resetCodeHash } from '../modules/auth/pin-reset.js';
import { hashPin } from '../services/pin-hasher.js';

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
  const { userId } = await app.prisma.businessMember.findUniqueOrThrow({
    where: { id: r.owner.memberId },
  });
  await app.prisma.user.update({
    where: { id: userId },
    data: { email: EMAIL, pinHash: await hashPin('111111') },
  });
});

const EMAIL = 'owner@example.com';
const CODE = '246810';

type Res = { statusCode: number; json: () => unknown };
const error = (res: Res) =>
  (res.json() as { error?: { code?: string; details?: { reason?: string; triesLeft?: number } } })
    .error;

/** A reset code as POST /auth/forgot-pin stores it (the test server sends no email). */
const giveCode = (expiresInMs = 10 * 60_000) =>
  app.prisma.emailCode.create({
    data: {
      email: EMAIL,
      codeHash: resetCodeHash(EMAIL, CODE),
      expiresAt: new Date(Date.now() + expiresInMs),
    },
  });
const reset = (code: string, newPin = '222222') =>
  app.inject({
    method: 'POST',
    url: '/api/v1/auth/reset-pin',
    payload: { email: EMAIL, code, newPin },
  });
const signIn = (pin: string) =>
  app.inject({ method: 'POST', url: '/api/v1/auth/sign-in-email', payload: { email: EMAIL, pin } });

describe('reset PIN', () => {
  it('right code sets the new PIN, the old one stops working and sessions end', async () => {
    await giveCode();
    const res = await reset(CODE);
    expect(res.statusCode).toBe(204);
    expect((await signIn('222222')).statusCode).toBe(200);
    expect(error(await signIn('111111'))?.code).toBe('WRONG_CREDENTIALS');
    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: headers(r.owner.token),
    });
    expect(me.statusCode).toBe(401);
  });

  it('wrong code counts down and the fifth kills the code, even for the right one', async () => {
    await giveCode();
    const first = error(await reset('000000'));
    expect(first).toMatchObject({ code: 'WRONG_CODE', details: { reason: 'wrong', triesLeft: 4 } });
    for (let i = 0; i < 3; i++) await reset('000000');
    expect(error(await reset('000000'))?.details).toMatchObject({ reason: 'tooManyTries' });
    expect(error(await reset(CODE))?.details).toMatchObject({ reason: 'tooManyTries' });
    expect((await signIn('111111')).statusCode).toBe(200); // PIN unchanged
  });

  it('expired code is refused', async () => {
    await giveCode(-1000);
    expect(error(await reset(CODE))).toMatchObject({
      code: 'WRONG_CODE',
      details: { reason: 'expired' },
    });
  });

  it('a used code cannot be used again', async () => {
    await giveCode();
    expect((await reset(CODE)).statusCode).toBe(204);
    expect(error(await reset(CODE, '333333'))).toMatchObject({
      code: 'WRONG_CODE',
      details: { reason: 'expired' },
    });
    expect((await signIn('222222')).statusCode).toBe(200);
  });

  it('wrong PIN length for the role is refused without spending the code', async () => {
    await giveCode();
    expect(error(await reset(CODE, '2222'))).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: { reason: 'pinLength', length: 6 },
    });
    expect((await reset(CODE)).statusCode).toBe(204);
  });
});
