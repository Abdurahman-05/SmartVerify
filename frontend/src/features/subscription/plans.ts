import { isNormalApp } from '@/lib/variant';
import type { BillingPeriod, Plan } from '@/store/session';

export type { BillingPeriod };

export const normalPricing: Record<BillingPeriod, { months: number; priceEtb: number }> = {
  monthly: { months: 1, priceEtb: 1000 },
  quarterly: { months: 3, priceEtb: 1500 },
};

export const normalQuarterlySavingEtb =
  normalPricing.monthly.priceEtb * normalPricing.quarterly.months -
  normalPricing.quarterly.priceEtb;

/** Normal Multi: any number of phones, monthly only. */
export const normalMultiMonthlyEtb = 1500;

export const restaurantMonthlyEtb = 4000;

/**
 * The plain plan this app sells: the Shop app's Normal (owner + 2 workers), or the Restaurant
 * app's Normal Verify (any number of waiters). Both: 1 or 3 months (prices set by the admin).
 */
export const normalPlan: Plan = isNormalApp ? 'normal' : 'restaurant_normal';

/** Plans that can be paid for 3 months at once. */
export const hasQuarterly = (plan: Plan) => plan === 'normal' || plan === 'restaurant_normal';

export const restaurantFeatureKeys = [
  'cashBank',
  'bankOnly',
  'cashOnly',
  'tips',
  'ledger',
  'chef',
] as const;

export const periodMonths = (period: BillingPeriod) => normalPricing[period].months;

export function priceFor(plan: Plan, period: BillingPeriod) {
  if (plan === 'restaurant') return restaurantMonthlyEtb;
  if (plan === 'normal_multi') return normalMultiMonthlyEtb;
  // Normal and Normal Verify start at the same prices (the server's are shown when paying).
  return normalPricing[period].priceEtb;
}
