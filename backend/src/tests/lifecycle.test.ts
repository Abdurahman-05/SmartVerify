import { describe, expect, it } from 'vitest';

import type { PlatformSettings } from '../generated/prisma/client.js';
import { coordinatesOf } from '../modules/business/business.routes.js';
import { accessOf, blockOf } from '../services/lifecycle.js';

const DAY = 24 * 60 * 60_000;
const settings: PlatformSettings = {
  id: 1,
  trialEnabled: true,
  trialDays: 14,
  reminderDays: [7, 3, 1],
  graceDays: 3,
  restrictedDays: 7,
  restrictedBlocks: ['receipt_checks', 'orders', 'reports', 'staff'],
  priceNormalMonthly: 700,
  priceNormalQuarterly: 1500,
  priceNormalMultiMonthly: 1500,
  priceRestaurantMonthly: 4000,
  updatedAt: new Date(),
};
const now = new Date('2026-10-21T12:00:00Z');
const ago = (days: number) => new Date(now.getTime() - days * DAY);
const paid = (endsInDays: number) => ({
  endsAt: new Date(now.getTime() + endsInDays * DAY),
  paymentMethod: 'cbe',
});
const business = (latest: ReturnType<typeof paid> | null, extra = {}) => ({
  createdAt: ago(60),
  suspendedAt: null,
  exemptFromRules: false,
  latest,
  ...extra,
});

describe('payment lifecycle', () => {
  it('trial, then active, then grace → restricted → suspended', () => {
    expect(accessOf(business(null, { createdAt: ago(2) }), settings, now).status).toBe('trial');
    expect(accessOf(business(paid(10)), settings, now)).toMatchObject({
      status: 'active',
      remind: false,
    });
    expect(accessOf(business(paid(2)), settings, now)).toMatchObject({
      status: 'active',
      remind: true,
    });
    expect(accessOf(business(paid(-1)), settings, now).status).toBe('grace');
    expect(accessOf(business(paid(-5)), settings, now).status).toBe('restricted');
    expect(accessOf(business(paid(-11)), settings, now).status).toBe('suspended');
    // Never paid, trial long over.
    expect(accessOf(business(null), settings, now).status).toBe('suspended');
  });

  it('exempt businesses stay active; a hand suspension always wins', () => {
    expect(accessOf(business(paid(-30), { exemptFromRules: true }), settings, now).status).toBe(
      'active'
    );
    expect(accessOf(business(paid(30), { suspendedAt: ago(1) }), settings, now)).toMatchObject({
      status: 'suspended',
      suspendedByAdmin: true,
    });
  });

  it('without a trial, a new business must pay first (grace from sign-up)', () => {
    const noTrial = { ...settings, trialEnabled: false };
    expect(accessOf(business(null, { createdAt: ago(1) }), noTrial, now).status).toBe('grace');
  });

  it('maps requests to what Restricted blocks', () => {
    expect(blockOf('POST', '/api/v1/verify/cbe')).toBe('receipt_checks');
    expect(blockOf('GET', '/api/v1/verify/failed')).toBeNull();
    expect(blockOf('POST', '/api/v1/orders')).toBe('orders');
    expect(blockOf('GET', '/api/v1/reports/payments?period=today')).toBe('reports');
    expect(blockOf('GET', '/api/v1/payments')).toBeNull();
  });
});

describe('business location', () => {
  it('reads Google Maps links and plain coordinates', () => {
    expect(
      coordinatesOf('https://www.google.com/maps/place/X/@8.5400,39.2700,17z/data=!3m1')
    ).toEqual({ latitude: 8.54, longitude: 39.27 });
    expect(coordinatesOf('https://maps.google.com/?q=9.0108,38.7613')).toEqual({
      latitude: 9.0108,
      longitude: 38.7613,
    });
    expect(coordinatesOf('9.03, 38.74')).toEqual({ latitude: 9.03, longitude: 38.74 });
    expect(coordinatesOf('https://maps.app.goo.gl/abc')).toBeNull();
  });
});
