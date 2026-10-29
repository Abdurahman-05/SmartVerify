import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { hashPassword } from '../modules/admin/admin-auth.js';
import { fetchReceipt, type FetchedReceipt } from '../modules/verification/fetch-receipt.js';
import { forgetAccess } from '../services/business-access.js';
import { forgetSettings } from '../services/platform-settings.js';
import { hashSessionToken, newSessionToken } from '../services/session-token.js';

import {
  createRestaurant,
  createTestApp,
  headers,
  newKey,
  resetDatabase,
  type Restaurant,
  type TestApp,
} from './helpers.js';

vi.mock('../modules/verification/fetch-receipt.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../modules/verification/fetch-receipt.js')>();
  return { ...real, fetchReceipt: vi.fn() };
});
vi.mock('../services/health.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../services/health.js')>();
  // No real network in tests: the bank sites answer as "not checked".
  return { ...real, checkBankSites: vi.fn(async () => []) };
});
const fetchMock = vi.mocked(fetchReceipt);

const DAY = 24 * 60 * 60_000;
let app: TestApp;
let r: Restaurant;
let admin = '';

beforeAll(async () => {
  app = await createTestApp({
    SUBSCRIPTION_CBE_ACCOUNT: '1000999990001',
    SUBSCRIPTION_CBE_NAME: 'Smart Verify PLC',
  });
  await resetDatabase(app);
  r = await createRestaurant(app);
  // A fully signed-in admin (sign-in itself is covered by admin-auth.test.ts).
  const user = await app.prisma.adminUser.create({
    data: {
      email: 'ops@smartverify.test',
      name: 'Ops',
      passwordHash: await hashPassword('a long test password'),
      totpEnabledAt: new Date(),
    },
  });
  admin = newSessionToken();
  await app.prisma.adminSession.create({
    data: {
      tokenHash: hashSessionToken(admin),
      adminId: user.id,
      stage: 'full',
      expiresAt: new Date(Date.now() + DAY),
    },
  });
});
afterAll(async () => {
  await app.close();
});
beforeEach(() => {
  fetchMock.mockReset();
});

const as = (token: string) => ({ authorization: `Bearer ${token}` });
const adminGet = (url: string) =>
  app.inject({ method: 'GET', url: `/api/v1${url}`, headers: as(admin) });
const adminPost = (url: string, payload?: object, method: 'POST' | 'PUT' = 'POST') =>
  app.inject({ method, url: `/api/v1${url}`, headers: as(admin), payload });

/** Moves the business's trial/paid end into the past by `days`. */
async function endedDaysAgo(days: number) {
  await app.prisma.business.update({
    where: { id: r.businessId },
    data: { createdAt: new Date(Date.now() - (14 + days) * DAY) },
  });
  await app.prisma.subscription.deleteMany({ where: { businessId: r.businessId } });
  // Changed behind the app's back: drop the remembered status.
  forgetAccess();
}

describe('admin console', () => {
  it('business tokens cannot open it', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/customers',
      headers: as(r.owner.token),
    });
    expect(res.statusCode).toBe(401);
  });

  it('lists customers with their status and opens one (logged as private data)', async () => {
    const list = await adminGet('/admin/customers');
    expect(list.json().items[0]).toMatchObject({ id: r.businessId, status: 'trial' });

    const one = await adminGet(`/admin/customers/${r.businessId}`);
    expect(one.json()).toMatchObject({ id: r.businessId, access: { status: 'trial' } });
    expect(one.json().people[0]).toMatchObject({ role: 'owner' });
    const views = await app.prisma.adminActivity.count({
      where: { action: 'viewed_customer', businessId: r.businessId },
    });
    expect(views).toBe(1);
  });

  it('late payment: grace works, restricted blocks receipt checks, suspended blocks all but paying', async () => {
    await endedDaysAgo(1);
    const access = await app.inject({
      method: 'GET',
      url: '/api/v1/business/access',
      headers: as(r.owner.token),
    });
    expect(access.json()).toMatchObject({ status: 'grace', remind: true });

    await endedDaysAgo(5);
    const check = await app.inject({
      method: 'POST',
      url: '/api/v1/verify/cbe',
      headers: headers(r.owner.token, newKey()),
      payload: { url: 'https://mbreciept.cbe.com.et/v2-AbCdEfGhIjKlMnOpQrSt', amountEtb: 100 },
    });
    expect(check.statusCode).toBe(402);
    expect(check.json().error.details).toMatchObject({
      access: 'restricted',
      block: 'receipt_checks',
    });
    // History still opens.
    const history = await app.inject({
      method: 'GET',
      url: '/api/v1/payments',
      headers: as(r.owner.token),
    });
    expect(history.statusCode).not.toBe(402);

    await endedDaysAgo(20);
    const menu = await app.inject({
      method: 'GET',
      url: '/api/v1/menu',
      headers: as(r.owner.token),
    });
    expect(menu.json().error.details).toMatchObject({ access: 'suspended' });
    const info = await app.inject({
      method: 'GET',
      url: '/api/v1/subscription/payment-info',
      headers: as(r.owner.token),
    });
    expect(info.statusCode).toBe(200);
  });

  it('extend and exempt lift the restriction at once', async () => {
    await endedDaysAgo(20);
    expect(
      (await adminPost(`/admin/customers/${r.businessId}/extend`, { days: 5 })).statusCode
    ).toBe(204);
    const one = await adminGet(`/admin/customers/${r.businessId}`);
    expect(one.json().access.status).toBe('active');

    await endedDaysAgo(20);
    await adminPost(`/admin/customers/${r.businessId}/exempt`, { exempt: true, reason: 'partner' });
    const menu = await app.inject({
      method: 'GET',
      url: '/api/v1/menu',
      headers: as(r.owner.token),
    });
    expect(menu.statusCode).toBe(200);
    await adminPost(`/admin/customers/${r.businessId}/exempt`, { exempt: false });
  });

  it('an amount slightly low goes to review; approving starts the plan', async () => {
    await endedDaysAgo(2);
    const { readFileSync } = await import('node:fs');
    const detail = JSON.parse(
      readFileSync(new URL('./fixtures/cbe-detail.json', import.meta.url), 'utf8')
    ) as Record<string, unknown>;
    const receipt: FetchedReceipt = {
      contentType: 'application/json',
      body: Buffer.from(
        JSON.stringify({
          ...detail,
          id: 'FT26294REVW1',
          platformTransactionType: 'A2A',
          creditAccountHolder: 'SMART VERIFY PLC',
          creditAccountNo: '1****0001',
          amountCredited: '950.00',
          dateTimes: [new Date(Date.now() - 60_000).toISOString()],
        })
      ),
    };
    fetchMock.mockResolvedValueOnce(receipt);
    const pay = await app.inject({
      method: 'POST',
      url: '/api/v1/subscription/pay',
      headers: headers(r.owner.token, newKey()),
      payload: {
        plan: 'normal',
        period: 'monthly',
        url: 'https://mbreciept.cbe.com.et/v2-ReviewReceipt0001',
      },
    });
    expect(pay.json()).toMatchObject({ review: 'pending', subscription: null });

    const queue = await adminGet('/admin/reviews');
    const item = queue.json().items[0];
    expect(item).toMatchObject({ paidEtb: 950, expectedEtb: 1000, reasons: ['AMOUNT_TOO_LOW'] });

    const ok = await adminPost(`/admin/reviews/${item.id}/decide`, {
      decision: 'approve',
      note: 'will pay 50 tomorrow',
    });
    expect(ok.statusCode).toBe(204);
    const access = await app.inject({
      method: 'GET',
      url: '/api/v1/business/access',
      headers: as(r.owner.token),
    });
    expect(access.json().status).toBe('active');
    expect(
      (await adminPost(`/admin/reviews/${item.id}/decide`, { decision: 'reject' })).statusCode
    ).toBe(409);
  });

  it('saves rules and prices (logged with before/after); payment-info shows the new price', async () => {
    const current = (await adminGet('/admin/settings')).json().settings;
    const saved = await adminPost(
      '/admin/settings',
      { ...current, priceNormalMonthly: 800 },
      'PUT'
    );
    expect(saved.json().priceNormalMonthly).toBe(800);
    forgetSettings();
    const info = await app.inject({
      method: 'GET',
      url: '/api/v1/subscription/payment-info',
      headers: as(r.owner.token),
    });
    expect(info.json().prices.normal.monthly).toBe(800);
    const logged = await app.prisma.adminActivity.findFirst({
      where: { action: 'changed_prices' },
    });
    expect(logged?.details).toMatchObject({ priceNormalMonthly: { from: 1000, to: 800 } });
  });

  it('announcements reach the business app; location comes from a Maps link', async () => {
    const now = Date.now();
    await adminPost('/admin/announcements', {
      bodyEn: 'Maintenance on Sunday',
      bodyAm: 'እሁድ ጥገና',
      audience: 'all',
      showFrom: new Date(now - 60_000).toISOString(),
      hideOn: new Date(now + DAY).toISOString(),
    });
    const shown = await app.inject({
      method: 'GET',
      url: '/api/v1/announcements',
      headers: as(r.owner.token),
    });
    expect(shown.json()[0]).toMatchObject({ bodyEn: 'Maintenance on Sunday' });

    const profile = await app.inject({
      method: 'PATCH',
      url: '/api/v1/business/profile',
      headers: as(r.owner.token),
      payload: { city: 'Adama', location: 'https://www.google.com/maps/@8.54,39.27,17z' },
    });
    expect(profile.json()).toMatchObject({ city: 'Adama', latitude: 8.54, longitude: 39.27 });
  });

  it('dashboard and health answer', async () => {
    const dash = await adminGet('/admin/dashboard');
    expect(dash.json().customers.total).toBe(1);
    const health = await adminGet('/admin/health');
    expect(health.json().database.ok).toBe(true);
  });
});
