import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { hashPassword } from '../modules/admin/admin-auth.js';
import { openSecret } from '../services/secret-box.js';
import { totpCode, totpStep } from '../services/totp.js';

import { createRestaurant, createTestApp, resetDatabase, type TestApp } from './helpers.js';

let app: TestApp;
const EMAIL = 'admin@smartverify.test';
const PASSWORD = 'correct horse battery';

beforeAll(async () => {
  app = await createTestApp();
  await resetDatabase(app);
  await app.prisma.adminUser.create({
    data: { email: EMAIL, name: 'Test Admin', passwordHash: await hashPassword(PASSWORD) },
  });
});
afterAll(async () => {
  await app.close();
});

const post = (url: string, payload?: object, token?: string) =>
  app.inject({
    method: 'POST',
    url: `/api/v1${url}`,
    payload,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
const get = (url: string, token?: string) =>
  app.inject({
    method: 'GET',
    url: `/api/v1${url}`,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });

/** The admin's code, worked out from the database as the authenticator app would show it. */
async function currentCode(offsetSteps = 0) {
  const admin = await app.prisma.adminUser.findUniqueOrThrow({ where: { email: EMAIL } });
  const secret = openSecret(admin.totpSecretEnc ?? '', app.env.ADMIN_SECRET_KEY ?? '');
  return totpCode(secret, totpStep() + offsetSteps);
}

describe('admin sign-in', () => {
  let fullToken = '';
  let backupCodes: string[] = [];

  it('first time: password, then authenticator setup, then backup codes', async () => {
    const step1 = await post('/admin/auth/sign-in', { email: EMAIL, password: PASSWORD });
    expect(step1.json()).toMatchObject({ next: 'setup' });
    const pending = step1.json().token as string;

    // A password-only token opens nothing else.
    expect((await get('/admin/me', pending)).statusCode).toBe(401);

    const setup = await post('/admin/auth/setup', undefined, pending);
    expect(setup.json().otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    const saved = await app.prisma.adminUser.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(saved.totpSecretEnc).not.toContain(setup.json().secret);

    const confirm = await post('/admin/auth/setup/confirm', { code: await currentCode() }, pending);
    expect(confirm.statusCode).toBe(200);
    backupCodes = confirm.json().backupCodes;
    expect(backupCodes).toHaveLength(8);
    fullToken = confirm.json().token;

    const me = await get('/admin/me', fullToken);
    expect(me.json()).toMatchObject({ email: EMAIL, role: 'super_admin', backupCodesLeft: 8 });
    expect(JSON.stringify(me.json())).not.toMatch(/passwordHash|totp/i);
    // The step-1 token was used up.
    expect((await post('/admin/auth/setup', undefined, pending)).statusCode).toBe(401);
  });

  it('later: password, then the code (or one backup code, once)', async () => {
    const step1 = await post('/admin/auth/sign-in', { email: EMAIL, password: PASSWORD });
    expect(step1.json().next).toBe('code');
    const wrong = await post('/admin/auth/verify', { code: '000000' }, step1.json().token);
    expect(wrong.json().error).toMatchObject({ code: 'WRONG_CODE' });

    const ok = await post('/admin/auth/verify', { code: await currentCode(1) }, step1.json().token);
    expect(ok.statusCode).toBe(200);

    const again = await post('/admin/auth/sign-in', { email: EMAIL, password: PASSWORD });
    const backup = backupCodes[0] ?? '';
    const used = await post('/admin/auth/verify', { backupCode: backup }, again.json().token);
    expect(used.statusCode).toBe(200);
    const third = await post('/admin/auth/sign-in', { email: EMAIL, password: PASSWORD });
    const reused = await post('/admin/auth/verify', { backupCode: backup }, third.json().token);
    expect(reused.json().error.code).toBe('WRONG_CODE');
  });

  it('business tokens never open the admin, and admin tokens never open the business API', async () => {
    const r = await createRestaurant(app);
    expect((await get('/admin/me', r.owner.token)).statusCode).toBe(401);
    expect((await get('/auth/me', fullToken)).statusCode).toBe(401);
  });

  it('records sign-ins in the activity log, without secrets', async () => {
    const log = await get('/admin/activity?category=sign_in', fullToken);
    const actions = log.json().items.map((i: { action: string }) => i.action);
    expect(actions).toEqual(
      expect.arrayContaining(['signed_in', 'two_step_enabled', 'backup_code_used'])
    );
    expect(JSON.stringify(log.json())).not.toContain(PASSWORD);
  });

  it('locks the account after 5 wrong passwords', async () => {
    // Start from zero (the reused backup code above counted as one wrong try).
    await app.prisma.adminUser.update({ where: { email: EMAIL }, data: { failedSignIns: 0 } });
    for (let i = 0; i < 4; i++) {
      const res = await post('/admin/auth/sign-in', { email: EMAIL, password: 'wrong password' });
      expect(res.json().error.code).toBe('WRONG_CREDENTIALS');
    }
    const fifth = await post('/admin/auth/sign-in', { email: EMAIL, password: 'wrong password' });
    expect(fifth.statusCode).toBe(423);
    // Even the right password waits until the lock ends.
    const right = await post('/admin/auth/sign-in', { email: EMAIL, password: PASSWORD });
    expect(right.json().error.code).toBe('ACCOUNT_LOCKED');
  });

  it('signs out', async () => {
    expect((await post('/admin/auth/sign-out', undefined, fullToken)).statusCode).toBe(204);
    expect((await get('/admin/me', fullToken)).statusCode).toBe(401);
  });
});

describe('browser access (admin console)', () => {
  it('allows only the listed web origins', async () => {
    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/admin/auth/sign-in',
      headers: { origin: 'http://localhost:8082', 'access-control-request-method': 'POST' },
    });
    expect(preflight.statusCode).toBe(204);
    expect(preflight.headers['access-control-allow-origin']).toBe('http://localhost:8082');
    expect(preflight.headers['access-control-allow-credentials']).toBeUndefined();

    const other = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { origin: 'https://evil.example' },
    });
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });
});
