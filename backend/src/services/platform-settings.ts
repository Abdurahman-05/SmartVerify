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
  const value = await prisma.platformSettings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });
  cached = { at: Date.now(), value };
  return value;
}

/** After the admin saves: everyone sees the new rules at once. */
export const forgetSettings = () => {
  cached = null;
};

/** Price and length of a plan. Restaurant Plus is monthly only. */
export function planPricing(
  settings: PlatformSettings,
  plan: Plan,
  period: BillingPeriod
): { priceEtb: number; months: number } | null {
  if (plan === 'restaurant') {
    return period === 'monthly' ? { priceEtb: settings.priceRestaurantMonthly, months: 1 } : null;
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
