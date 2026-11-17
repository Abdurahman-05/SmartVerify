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

type Res = { statusCode: number; json: () => unknown };
const post = (url: string, payload: object) =>
  app.inject({ method: 'POST', url: `/api/v1${url}`, payload });
const error = (res: Res) =>
  (res.json() as { error?: { code?: string; details?: Record<string, unknown> } }).error;

let n = 0;
const newEmail = () => `owner${++n}-${Date.now()}@example.com`;
const sendCode = async (email: string) => {
  const res = await post('/auth/email-code', { email });
  expect(res.statusCode).toBe(200);
  return (res.json() as { devCode: string }).devCode;
};
const register = (email: string, phone = `9${String(10_000_000 + n).slice(-8)}`) =>
  post('/auth/register', {
    fullName: 'Owner Test',
    businessName: 'Test Cafe',
    email,
    phone,
    pin: '135790',
  });

describe('email codes for owner sign-up', () => {
  it('sends a code (returned as devCode without a provider) and stores only a hash', async () => {
    const email = newEmail();
    const code = await sendCode(email);
    expect(code).toMatch(/^\d{6}$/);
    const row = await app.prisma.emailCode.findFirstOrThrow({ where: { email } });
    expect(row.codeHash).not.toContain(code);
  });

  it('the right code lets the owner sign up once', async () => {
    const email = newEmail();
    const code = await sendCode(email);
    const ok = await post('/auth/verify-email', { email, code });
    expect(ok.statusCode).toBe(200);
    expect((await register(email)).statusCode).toBe(201);
    // The same proof cannot make a second account.
    const again = await register(email, '977777777');
    expect(again.statusCode).toBe(409);
  });

  it('sign-up without a verified email is refused', async () => {
    const email = newEmail();
    await sendCode(email);
    const res = await register(email);
    expect(res.statusCode).toBe(403);
    expect(error(res)?.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('a wrong code counts down; the fifth wrong try ends the code', async () => {
    const email = newEmail();
    const code = await sendCode(email);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let left = 4; left >= 1; left--) {
      const res = await post('/auth/verify-email', { email, code: wrong });
      expect(res.statusCode).toBe(401);
      expect(error(res)?.details).toMatchObject({ reason: 'wrong', triesLeft: left });
    }
    const last = await post('/auth/verify-email', { email, code: wrong });
    expect(error(last)?.details).toMatchObject({ reason: 'tooManyTries', triesLeft: 0 });
    // Even the right code no longer works.
    const right = await post('/auth/verify-email', { email, code });
    expect(error(right)?.details).toMatchObject({ reason: 'tooManyTries' });
  });

  it('an expired code is refused', async () => {
    const email = newEmail();
    const code = await sendCode(email);
    await app.prisma.emailCode.updateMany({
      where: { email },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const res = await post('/auth/verify-email', { email, code });
    expect(res.statusCode).toBe(401);
    expect(error(res)?.details).toMatchObject({ reason: 'expired' });
  });

  it('a new code waits 45 s; an email already in use is refused', async () => {
    const email = newEmail();
    await sendCode(email);
    const soon = await post('/auth/email-code', { email });
    expect(soon.statusCode).toBe(429);
    expect(error(soon)?.details).toMatchObject({ reason: 'tooSoon' });

    const used = newEmail();
    const code = await sendCode(used);
    await post('/auth/verify-email', { email: used, code });
    await register(used);
    const taken = await post('/auth/email-code', { email: used });
    expect(taken.statusCode).toBe(409);
  });
});
