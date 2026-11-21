import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createTestApp, resetDatabase, type TestApp } from './helpers.js';

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

const post = (url: string, payload: unknown) =>
  app.inject({ method: 'POST', url: `/api/v1${url}`, payload: payload as object });
const shop = {
  fullName: 'Abebe Kebede',
  businessName: 'Bole Mart',
  phone: '912345678',
  pin: '1234',
};

describe('shop sign-up (phone + 4-digit PIN, no email)', () => {
  it('creates the owner without an email, then signs in by phone', async () => {
    const res = await post('/auth/register-shop', shop);
    expect(res.statusCode).toBe(201);
    const user = await app.prisma.user.findUniqueOrThrow({ where: { phone: shop.phone } });
    expect(user.email).toBeNull();
    expect(user.pinHash).not.toContain('1234');
    const again = await post('/auth/sign-in', { phone: shop.phone, pin: '1234' });
    expect(again.statusCode).toBe(200);
  });

  it('refuses a taken phone and a 6-digit PIN', async () => {
    await post('/auth/register-shop', shop);
    expect((await post('/auth/register-shop', shop)).statusCode).toBe(409);
    const six = await post('/auth/register-shop', { ...shop, phone: '922222222', pin: '123456' });
    expect(six.statusCode).toBe(400);
  });

  it('locks a shop account for 15 minutes after 5 wrong PINs, and a right PIN resets the count', async () => {
    const phone = '933333333';
    await post('/auth/register-shop', { ...shop, phone });
    const read = () => app.prisma.user.findUniqueOrThrow({ where: { phone } });
    for (let i = 0; i < 2; i++) await post('/auth/sign-in', { phone, pin: '9999' });
    expect((await read()).failedPinAttempts).toBe(2);
    expect((await post('/auth/sign-in', { phone, pin: '1234' })).statusCode).toBe(200);
    expect((await read()).failedPinAttempts).toBe(0);
    // Five in a row: the account is locked (the sixth call would also meet the IP limit, so the
    // lock itself is read from the database).
    await app.prisma.user.update({ where: { phone }, data: { failedPinAttempts: 4 } });
    // The IP limit (5 per 15 minutes) is almost used up; this is the fifth call for this phone.
    await post('/auth/sign-in', { phone, pin: '9999' });
    const locked = await read();
    expect(locked.pinLockedUntil && locked.pinLockedUntil.getTime() > Date.now()).toBe(true);
  });
});
