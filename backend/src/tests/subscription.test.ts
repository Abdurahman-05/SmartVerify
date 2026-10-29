import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createRestaurant,
  createTestApp,
  headers,
  newKey,
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
  r = await createRestaurant(app, null); // signed up, no plan yet
});

const explore = (token: string, plan: string) =>
  app.inject({
    method: 'PATCH',
    url: '/api/v1/business/plan',
    headers: headers(token),
    payload: { plan },
  });
const subscribe = (token: string, body: object, key = newKey(), target = app) =>
  target.inject({
    method: 'POST',
    url: '/api/v1/subscription',
    headers: headers(token, key),
    payload: body,
  });
const me = (token: string) =>
  app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: headers(token) });
const menu = (token: string) =>
  app.inject({ method: 'GET', url: '/api/v1/menu', headers: headers(token) });

const errorCode = (res: { json: () => unknown }) =>
  (res.json() as { error?: { code?: string } }).error?.code;
const months = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / (30.4 * 86_400_000));

describe('plan and subscription', () => {
  it('Explore sets the business plan in the database; staff get it at once', async () => {
    expect(errorCode(await menu(r.waiter.token))).toBe('SUBSCRIPTION_REQUIRED');

    const res = await explore(r.owner.token, 'restaurant');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ plan: 'restaurant' });
    expect(
      (await app.prisma.business.findUniqueOrThrow({ where: { id: r.businessId } })).plan
    ).toBe('restaurant');

    expect((await menu(r.waiter.token)).statusCode).toBe(200);
    expect((await me(r.waiter.token)).json()).toMatchObject({
      plan: 'restaurant',
      subscription: null,
    });
  });

  it('subscribe: server prices, lengths, plan saved, shown in /auth/me', async () => {
    const res = await subscribe(r.owner.token, { plan: 'normal', period: 'quarterly' });
    expect(res.statusCode).toBe(201);
    const sub = res.json();
    expect(sub).toMatchObject({ plan: 'normal', period: 'quarterly', priceEtb: 1500 });
    expect(months(sub.startedAt, sub.endsAt)).toBe(3);
    expect((await me(r.owner.token)).json()).toMatchObject({ plan: 'normal', subscription: sub });

    const monthly = (await subscribe(r.owner.token, { plan: 'normal', period: 'monthly' })).json();
    expect(monthly).toMatchObject({ priceEtb: 1000 });
    expect(months(monthly.startedAt, monthly.endsAt)).toBe(1);
  });

  it('Restaurant Plus is always monthly at 4,000 ETB and replaces the old subscription', async () => {
    await subscribe(r.owner.token, { plan: 'normal', period: 'quarterly' });
    const res = await subscribe(r.owner.token, { plan: 'restaurant', period: 'quarterly' });
    expect(res.json()).toMatchObject({ plan: 'restaurant', period: 'monthly', priceEtb: 4000 });

    const rows = await app.prisma.subscription.findMany({ where: { businessId: r.businessId } });
    expect(rows.filter((s) => s.status === 'active')).toHaveLength(1);
    expect(rows.filter((s) => s.status === 'cancelled')).toHaveLength(1);
    expect((await me(r.manager.token)).json()).toMatchObject({
      plan: 'restaurant',
      subscription: { priceEtb: 4000 },
    });
    expect((await menu(r.waiter.token)).statusCode).toBe(200);
  });

  it('same Idempotency-Key twice -> one subscription', async () => {
    const key = newKey();
    const body = { plan: 'restaurant', period: 'monthly' };
    const [a, b] = await Promise.all([
      subscribe(r.owner.token, body, key),
      subscribe(r.owner.token, body, key),
    ]);
    expect([a.statusCode, b.statusCode]).toEqual([201, 201]);
    expect(b.json()).toEqual(a.json());
    expect(await app.prisma.subscription.count({ where: { businessId: r.businessId } })).toBe(1);
  });

  it('owner only; bad input rejected', async () => {
    expect(errorCode(await explore(r.manager.token, 'restaurant'))).toBe('FORBIDDEN');
    expect(errorCode(await subscribe(r.waiter.token, { plan: 'normal', period: 'monthly' }))).toBe(
      'FORBIDDEN'
    );
    expect(errorCode(await explore(r.owner.token, 'gold'))).toBe('VALIDATION_ERROR');
    expect(errorCode(await subscribe(r.owner.token, { plan: 'normal', period: 'yearly' }))).toBe(
      'VALIDATION_ERROR'
    );
    const noKey = await app.inject({
      method: 'POST',
      url: '/api/v1/subscription',
      headers: headers(r.owner.token),
      payload: { plan: 'normal', period: 'monthly' },
    });
    expect(noKey.statusCode).toBe(400);
  });

  it('production refuses unpaid subscriptions unless switched on', async () => {
    const prod = await createTestApp({ NODE_ENV: 'production' });
    try {
      const res = await subscribe(
        r.owner.token,
        { plan: 'restaurant', period: 'monthly' },
        newKey(),
        prod
      );
      expect(res.statusCode).toBe(501);
      expect(errorCode(res)).toBe('PAYMENT_NOT_CONFIGURED');
    } finally {
      await prod.close();
    }
    const allowed = await createTestApp({
      NODE_ENV: 'production',
      ALLOW_UNPAID_SUBSCRIPTIONS: 'true',
    });
    try {
      const res = await subscribe(
        r.owner.token,
        { plan: 'restaurant', period: 'monthly' },
        newKey(),
        allowed
      );
      expect(res.statusCode).toBe(201);
    } finally {
      await allowed.close();
    }
  });
});
