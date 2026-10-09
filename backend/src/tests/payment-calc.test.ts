import { describe, expect, it } from 'vitest';

import { billTotal, calcCash, calcPayment } from '../modules/payments/payment-calc.js';
import { periodRange, startOfBusinessDay } from '../shared/utils/business-day.js';

describe('calcPayment (bank, cash + bank)', () => {
  it('exact bank payment is paid', () => {
    expect(calcPayment({ total: 1000, received: 1000 })).toEqual({
      expectedBank: 1000,
      status: 'paid',
      remaining: 0,
      tip: 0,
    });
  });
  it('extra bank money becomes the tip', () => {
    expect(calcPayment({ total: 1000, received: 1200 })).toEqual({
      expectedBank: 1000,
      status: 'over',
      remaining: 0,
      tip: 200,
    });
  });
  it('cash + bank short leaves the remaining amount', () => {
    expect(calcPayment({ total: 1000, cash: 400, received: 500 })).toEqual({
      expectedBank: 600,
      status: 'short',
      remaining: 100,
      tip: 0,
    });
  });
  it('rejects cash covering the whole bill and non-integer amounts', () => {
    expect(() => calcPayment({ total: 1000, cash: 1000, received: 0 })).toThrow(RangeError);
    expect(() => calcPayment({ total: 10.5, received: 10 })).toThrow(RangeError);
  });
});

describe('calcCash (cash only)', () => {
  it('missing cash is invalid', () => {
    expect(calcCash({ total: 1000, cash: 800, extraChoice: 'tip' })).toMatchObject({
      valid: false,
      missing: 200,
    });
  });
  it('extra cash is a tip or change', () => {
    expect(calcCash({ total: 1000, cash: 1200, extraChoice: 'tip' })).toMatchObject({
      valid: true,
      tip: 200,
      change: 0,
    });
    expect(calcCash({ total: 1000, cash: 1200, extraChoice: 'giveback' })).toMatchObject({
      valid: true,
      tip: 0,
      change: 200,
    });
  });
});

describe('billTotal', () => {
  it('is food + packing + delivery', () => {
    expect(billTotal(530, 30, 100)).toBe(660);
  });
});

describe('business day (Africa/Addis_Ababa, UTC+3)', () => {
  it('today starts at 00:00 Addis time = 21:00 UTC the day before', () => {
    const at = new Date('2026-10-04T10:00:00Z');
    expect(startOfBusinessDay('Africa/Addis_Ababa', at).toISOString()).toBe(
      '2026-10-03T21:00:00.000Z'
    );
  });
  it('late evening UTC already belongs to the next Addis day', () => {
    const at = new Date('2026-10-04T22:30:00Z');
    expect(startOfBusinessDay('Africa/Addis_Ababa', at).toISOString()).toBe(
      '2026-10-04T21:00:00.000Z'
    );
  });
  it('7 days covers today and the six days before', () => {
    const { from } = periodRange('7d', 'Africa/Addis_Ababa', new Date('2026-10-04T10:00:00Z'));
    expect(from.toISOString()).toBe('2026-09-27T21:00:00.000Z');
  });
});
