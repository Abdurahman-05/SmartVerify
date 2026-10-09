import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  addStaff,
  bearer,
  createTestApp,
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

describe('plans and subscriptions', () => {
  it('owner starts a subscription; price comes from the server; staff get the plan', async () => {
    const owner = await registerOwner(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/subscription',
      headers: bearer(owner.token),
      payload: { plan: 'normal', period: 'quarterly' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ plan: 'normal', period: 'quarterly', priceEtb: 1500 });

    const { payload } = await addStaff(app, owner.token, { role: 'waiter', pin: '1111' });
    const staff = await signIn(app, payload.phone, '1111');
    expect(staff.json().user).toMatchObject({ plan: 'normal', subscription: { priceEtb: 1500 } });
  });

  it('Restaurant Plus is monthly only, and only the owner can subscribe', async () => {
    const owner = await registerOwner(app);
    const quarterly = await app.inject({
      method: 'POST',
      url: '/api/v1/subscription',
      headers: bearer(owner.token),
      payload: { plan: 'restaurant', period: 'quarterly' },
    });
    expect(quarterly.statusCode).toBe(400);

    const { payload } = await addStaff(app, owner.token, { role: 'manager', pin: '2222' });
    const managerToken = (await signIn(app, payload.phone, '2222')).json().token;
    const byManager = await app.inject({
      method: 'POST',
      url: '/api/v1/subscription',
      headers: bearer(managerToken),
      payload: { plan: 'normal', period: 'monthly' },
    });
    expect(byManager.statusCode).toBe(403);
  });

  it('refuses to start a paid plan when unpaid subscriptions are not allowed', async () => {
    const strict = await createTestApp({ env: { ALLOW_UNPAID_SUBSCRIPTIONS: 'false' } });
    try {
      const owner = await registerOwner(strict);
      const res = await strict.inject({
        method: 'POST',
        url: '/api/v1/subscription',
        headers: bearer(owner.token),
        payload: { plan: 'normal', period: 'monthly' },
      });
      expect(res.statusCode).toBe(501);
      expect(res.json()).toEqual({ error: { code: 'PAYMENT_NOT_CONFIGURED' } });
    } finally {
      await strict.close();
    }
  });

  it('restaurant endpoints require the restaurant plan (or exploring)', async () => {
    const owner = await registerOwner(app);
    const exploring = await app.inject({
      method: 'GET',
      url: '/api/v1/tables',
      headers: bearer(owner.token),
    });
    expect(exploring.statusCode).toBe(200);

    await app.inject({
      method: 'PATCH',
      url: '/api/v1/business/plan',
      headers: bearer(owner.token),
      payload: { plan: 'normal' },
    });
    const normal = await app.inject({
      method: 'GET',
      url: '/api/v1/menu',
      headers: bearer(owner.token),
    });
    expect(normal.statusCode).toBe(402);
    expect(normal.json()).toEqual({ error: { code: 'SUBSCRIPTION_REQUIRED' } });
  });
});
