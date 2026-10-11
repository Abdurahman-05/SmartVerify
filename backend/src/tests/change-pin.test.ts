import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

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
});

type Res = { statusCode: number; json: () => unknown };
const code = (res: Res) => (res.json() as { error?: { code?: string } }).error?.code;

const register = async (phone: string, pin: string) => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { fullName: 'Pin Owner', businessName: 'Pin Cafe', phone, pin },
  });
  return (res.json() as { token: string }).token;
};
const signIn = (phone: string, pin: string) =>
  app.inject({ method: 'POST', url: '/api/v1/auth/sign-in', payload: { phone, pin } });
const changePin = (token: string, currentPin: string, newPin: string) =>
  app.inject({
    method: 'POST',
    url: '/api/v1/auth/change-pin',
    headers: headers(token),
    payload: { currentPin, newPin },
  });
const me = (token: string) =>
  app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: headers(token) });

describe('change PIN', () => {
  it('owner: new 6-digit PIN works, old one stops working, other devices are signed out', async () => {
    const phone = '799990001';
    const thisPhone = await register(phone, '123456');
    const otherPhone = ((await signIn(phone, '123456')).json() as { token: string }).token;

    const res = await changePin(thisPhone, '123456', '654321');
    expect(res.statusCode).toBe(204);

    expect((await me(thisPhone)).statusCode).toBe(200); // this device stays signed in
    expect(code(await me(otherPhone))).toBe('UNAUTHORIZED');
    expect(code(await signIn(phone, '123456'))).toBe('WRONG_CREDENTIALS');
    expect((await signIn(phone, '654321')).statusCode).toBe(200);
  });

  it('wrong current PIN, wrong length or the same PIN are refused', async () => {
    const phone = '799990002';
    const token = await register(phone, '123456');
    expect(code(await changePin(token, '000000', '654321'))).toBe('WRONG_CREDENTIALS');
    expect(code(await changePin(token, '123456', '1234'))).toBe('VALIDATION_ERROR'); // owner needs 6
    expect(code(await changePin(token, '123456', '123456'))).toBe('VALIDATION_ERROR');
    expect(code(await changePin(token, '123456', '12ab56'))).toBe('VALIDATION_ERROR');
    expect((await signIn(phone, '123456')).statusCode).toBe(200); // nothing changed
  });

  it('staff use 4 digits and a temporary PIN stops being temporary', async () => {
    const waiter = await app.prisma.businessMember.findUniqueOrThrow({
      where: { id: r.waiter.memberId },
      select: { userId: true },
    });
    await app.prisma.user.update({
      where: { id: waiter.userId },
      data: { pinHash: await hashPin('1111'), pinIsTemporary: true },
    });
    expect(code(await changePin(r.waiter.token, '1111', '123456'))).toBe('VALIDATION_ERROR');
    expect((await changePin(r.waiter.token, '1111', '2468')).statusCode).toBe(204);
    const user = await app.prisma.user.findUniqueOrThrow({ where: { id: waiter.userId } });
    expect(user.pinIsTemporary).toBe(false);
  });

  it('too many wrong tries are rate limited; signed-out users cannot change a PIN', async () => {
    const token = await register('799990003', '123456');
    const codes: (string | undefined)[] = [];
    for (let i = 0; i < 6; i++) codes.push(code(await changePin(token, '000000', '654321')));
    expect(codes.slice(0, 5)).toEqual(Array(5).fill('WRONG_CREDENTIALS'));
    expect(codes[5]).toBe('RATE_LIMITED');

    const anonymous = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-pin',
      payload: { currentPin: '123456', newPin: '654321' },
    });
    expect(code(anonymous)).toBe('UNAUTHORIZED');
  });
});
