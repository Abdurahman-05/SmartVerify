import type {
  BillingPeriod,
  Plan,
  PlatformSettings,
  PrismaClient,
} from '../generated/prisma/client.js';

/** The admin's rules and prices. Read often, changed rarely: cached for 30 seconds. */
let cached: { at: number; value: PlatformSettings } | null = null;
const TTL_MS = 30_000;

export async function getSettings(prisma: PrismaClient): Promise<PlatformSettings> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  // First use: create the row with the defaults (safe when two requests do it at once).
  await prisma.platformSettings.createMany({ data: [{ id: 1 }], skipDuplicates: true });
  const value = await prisma.platformSettings.findUniqueOrThrow({ where: { id: 1 } });
  cached = { at: Date.now(), value };
  return value;
}

/** After the admin saves: everyone sees the new rules at once. */
export const forgetSettings = () => {
  cached = null;
};

/** Price and length of a plan. Normal and the Restaurant app's Normal Verify: 1 or 3 months; Normal Multi and Restaurant Plus: monthly only. */
export function planPricing(
  settings: PlatformSettings,
  plan: Plan,
  period: BillingPeriod
): { priceEtb: number; months: number } | null {
  if (plan === 'restaurant') {
    return period === 'monthly' ? { priceEtb: settings.priceRestaurantMonthly, months: 1 } : null;
  }
  if (plan === 'restaurant_normal') {
    return period === 'monthly'
      ? { priceEtb: settings.priceRestaurantNormalMonthly, months: 1 }
      : { priceEtb: settings.priceRestaurantNormalQuarterly, months: 3 };
  }
  if (plan === 'normal_multi') {
    return period === 'monthly' ? { priceEtb: settings.priceNormalMultiMonthly, months: 1 } : null;
  }
  return period === 'monthly'
    ? { priceEtb: settings.priceNormalMonthly, months: 1 }
    : { priceEtb: settings.priceNormalQuarterly, months: 3 };
}

export const addMonths = (date: Date, months: number) => {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
};
