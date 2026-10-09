import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  bearer,
  createTestApp,
  nextPhone,
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

describe('health', () => {
  it('reports the database as up', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', database: 'ok' });
  });

  it('returns a NOT_FOUND code for unknown routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: { code: 'NOT_FOUND' } });
  });
});

describe('POST /auth/register', () => {
  it('creates the owner and business with no plan, and never returns the PIN', async () => {
    const phone = nextPhone();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        fullName: 'Abebe Example',
        businessName: 'Example Business',
        phone,
        pin: '123456',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.token).toEqual(expect.any(String));
    expect(body.user).toMatchObject({
      displayName: 'Abebe Example',
      businessName: 'Example Business',
      phone,
      role: 'owner',
      plan: null,
      subscription: null,
    });
    expect(res.body).not.toContain('123456');
    expect(res.body).not.toMatch(/pin/i);

    const user = await app.prisma.user.findUniqueOrThrow({ where: { phone } });
    expect(user.pinHash).toMatch(/^\$argon2id\$/);
  });

  it('rejects a phone that is already registered', async () => {
    const owner = await registerOwner(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { fullName: 'Other', businessName: 'Other Biz', phone: owner.phone, pin: '654321' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: { code: 'PHONE_TAKEN' } });
  });

  it('validates the body and returns VALIDATION_ERROR', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { fullName: 'A', businessName: 'B', phone: '0912345678', pin: '12345' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /auth/sign-in', () => {
  it('signs the owner in with phone + PIN', async () => {
    const owner = await registerOwner(app);
    const res = await signIn(app, owner.phone, owner.pin);
    expect(res.statusCode).toBe(200);
    expect(res.json().user).toMatchObject({ role: 'owner', phone: owner.phone });
  });

  it('gives the same WRONG_CREDENTIALS error for a wrong PIN and an unknown phone', async () => {
    const owner = await registerOwner(app);
    const wrongPin = await signIn(app, owner.phone, '000000');
    const unknown = await signIn(app, nextPhone(), '123456');
    expect(wrongPin.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrongPin.json()).toEqual({ error: { code: 'WRONG_CREDENTIALS' } });
    expect(unknown.json()).toEqual(wrongPin.json());
  });

  it('rate-limits repeated attempts for the same phone', async () => {
    const limited = await createTestApp({ env: { SIGN_IN_MAX_ATTEMPTS: '3' } });
    try {
      const phone = nextPhone();
      const codes: number[] = [];
      for (let i = 0; i < 4; i++) codes.push((await signIn(limited, phone, '999999')).statusCode);
      expect(codes).toEqual([401, 401, 401, 429]);
      const last = await signIn(limited, phone, '999999');
      expect(last.json()).toEqual({ error: { code: 'RATE_LIMITED' } });
    } finally {
      await limited.close();
    }
  });
});

describe('sessions', () => {
  it('rejects requests without a token or with a bad token', async () => {
    const none = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
    const bad = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: bearer('not-a-jwt'),
    });
    expect(none.statusCode).toBe(401);
    expect(bad.statusCode).toBe(401);
    expect(none.json()).toEqual({ error: { code: 'UNAUTHORIZED' } });
  });

  it('sign-out revokes the token immediately', async () => {
    const owner = await registerOwner(app);
    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: bearer(owner.token),
    });
    expect(me.statusCode).toBe(200);

    const out = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sign-out',
      headers: bearer(owner.token),
    });
    expect(out.statusCode).toBe(204);

    const after = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: bearer(owner.token),
    });
    expect(after.statusCode).toBe(401);
  });

  it('rejects an expired session even if the JWT itself is still valid', async () => {
    const owner = await registerOwner(app);
    await app.prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: bearer(owner.token),
    });
    expect(res.statusCode).toBe(401);
  });
});
