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

const giveEmail = async (memberId: string, email: string, pin: string) => {
  const { userId } = await app.prisma.businessMember.findUniqueOrThrow({ where: { id: memberId } });
  await app.prisma.user.update({
    where: { id: userId },
    data: { email, pinHash: await hashPin(pin) },
  });
};
const signIn = (email: string, pin: string) =>
  app.inject({ method: 'POST', url: '/api/v1/auth/sign-in-email', payload: { email, pin } });

describe('email sign-in', () => {
  it('right PIN gives a token and the real plan; wrong PIN is WRONG_CREDENTIALS', async () => {
    await giveEmail(r.owner.memberId, 'owner@example.com', '123456');

    const wrong = await signIn('owner@example.com', '000000');
    expect(wrong.statusCode).toBe(401);
    expect(code(wrong)).toBe('WRONG_CREDENTIALS');

    const ok = await signIn('  Owner@Example.com ', '123456');
    expect(ok.statusCode).toBe(200);
    const body = ok.json() as { token: string; user: { role: string; plan: string } };
    expect(body.token).toBeTruthy();
    expect(body.user).toMatchObject({ role: 'owner', plan: 'restaurant' });
    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: headers(body.token),
    });
    expect(me.statusCode).toBe(200);
  });

  it('unknown email and staff roles are refused the same way', async () => {
    await giveEmail(r.waiter.memberId, 'waiter@example.com', '1234');
    expect(code(await signIn('nobody@example.com', '123456'))).toBe('WRONG_CREDENTIALS');
    expect(code(await signIn('waiter@example.com', '1234'))).toBe('WRONG_CREDENTIALS');
  });

  it('too many tries are rate limited', async () => {
    await giveEmail(r.manager.memberId, 'manager@example.com', '1234');
    const codes: (string | undefined)[] = [];
    for (let i = 0; i < 6; i++) codes.push(code(await signIn('manager@example.com', '0000')));
    expect(codes[5]).toBe('RATE_LIMITED');
  });
});
