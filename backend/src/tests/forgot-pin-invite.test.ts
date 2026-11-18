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

const setEmail = async (memberId: string, email: string) => {
  const { userId } = await app.prisma.businessMember.findUniqueOrThrow({ where: { id: memberId } });
  await app.prisma.user.update({ where: { id: userId }, data: { email } });
};
const forgot = (email: string) =>
  app.inject({ method: 'POST', url: '/api/v1/auth/forgot-pin', payload: { email } });
const codesFor = (email: string) => app.prisma.emailCode.count({ where: { email } });

describe('forgot PIN', () => {
  it('owner gets one code; a second ask too soon is skipped but answers the same', async () => {
    await setEmail(r.owner.memberId, 'owner@example.com');
    const first = await forgot('Owner@Example.com');
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ resendInSeconds: 45 });
    expect(await codesFor('owner@example.com')).toBe(1);

    const again = await forgot('owner@example.com');
    expect(again.statusCode).toBe(200);
    expect(await codesFor('owner@example.com')).toBe(1);
  });

  it('unknown emails and staff roles get the same answer and no code', async () => {
    await setEmail(r.waiter.memberId, 'waiter@example.com');
    for (const email of ['nobody@example.com', 'waiter@example.com']) {
      const res = await forgot(email);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ resendInSeconds: 45 });
      expect(await codesFor(email)).toBe(0);
    }
  });

  it('a bad email is a validation error', async () => {
    expect(code(await forgot('not-an-email'))).toBe('VALIDATION_ERROR');
  });
});

describe('invite manager', () => {
  const body = { name: 'New Manager', email: 'Manager@Example.com', phone: '788880001' };
  const invite = (token: string, payload: object = body) =>
    app.inject({
      method: 'POST',
      url: '/api/v1/staff/invite',
      headers: headers(token),
      payload,
    });

  it('owner creates a manager with email and a temporary PIN; a retry returns the same one', async () => {
    const res = await invite(r.owner.token);
    expect(res.statusCode).toBe(201);
    const made = res.json() as { id: string; role: string; email: string; inviteSent: boolean };
    expect(made).toMatchObject({
      role: 'manager',
      email: 'manager@example.com',
      inviteSent: true,
      pinIsTemporary: true,
    });
    const user = await app.prisma.user.findUniqueOrThrow({
      where: { email: 'manager@example.com' },
    });
    expect(user.pinIsTemporary).toBe(true);

    const retry = await invite(r.owner.token);
    expect(retry.statusCode).toBe(201);
    expect((retry.json() as { id: string }).id).toBe(made.id);
  });

  it('only the owner can invite; taken email or phone are refused', async () => {
    expect(code(await invite(r.manager.token))).toBe('FORBIDDEN');
    await setEmail(r.waiter.memberId, 'taken@example.com');
    expect(code(await invite(r.owner.token, { ...body, email: 'taken@example.com' }))).toBe(
      'EMAIL_TAKEN'
    );
    await invite(r.owner.token);
    expect(code(await invite(r.owner.token, { ...body, email: 'other@example.com' }))).toBe(
      'PHONE_TAKEN'
    );
  });
});
