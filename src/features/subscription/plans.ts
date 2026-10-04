export type BillingPeriod = 'monthly' | 'quarterly';

export const normalPricing: Record<BillingPeriod, { months: number; priceEtb: number }> = {
  monthly: { months: 1, priceEtb: 700 },
  quarterly: { months: 3, priceEtb: 1500 },
};

export const normalQuarterlySavingEtb =
  normalPricing.monthly.priceEtb * normalPricing.quarterly.months - normalPricing.quarterly.priceEtb;

export const restaurantMonthlyEtb = 4000;

export const restaurantFeatureKeys = [
  'cashBank',
  'bankOnly',
  'cashOnly',
  'tips',
  'ledger',
  'chef',
] as const;
