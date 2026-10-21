import type { PlatformSettings, PrismaClient } from '../../generated/prisma/client.js';
import { accessOf, type AccessInfo } from '../../services/lifecycle.js';

/** One business as the admin's lists see it: who, where, plan and payment status. */
export interface CustomerRow {
  id: string;
  name: string;
  businessType: string | null;
  city: string | null;
  plan: 'normal' | 'restaurant' | null;
  ownerName: string;
  ownerPhone: string;
  createdAt: Date;
  access: AccessInfo;
  latest: { endsAt: Date; priceEtb: number; period: string; paymentMethod: string | null } | null;
}

/** All businesses with their status. Fine for thousands; paged by the caller. */
export async function loadCustomers(
  prisma: PrismaClient,
  settings: PlatformSettings,
  now = new Date()
): Promise<CustomerRow[]> {
  const [businesses, subscriptions] = await Promise.all([
    prisma.business.findMany({
      where: { deactivatedAt: null },
      select: {
        id: true,
        name: true,
        businessType: true,
        city: true,
        plan: true,
        createdAt: true,
        suspendedAt: true,
        exemptFromRules: true,
        owner: { select: { name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.subscription.findMany({
      where: { status: { not: 'cancelled' } },
      orderBy: { endsAt: 'desc' },
      select: {
        businessId: true,
        endsAt: true,
        priceEtb: true,
        period: true,
        paymentMethod: true,
      },
    }),
  ]);
  const latestOf = new Map<string, (typeof subscriptions)[number]>();
  for (const s of subscriptions) if (!latestOf.has(s.businessId)) latestOf.set(s.businessId, s);

  return businesses.map((b) => {
    const latest = latestOf.get(b.id) ?? null;
    return {
      id: b.id,
      name: b.name,
      businessType: b.businessType,
      city: b.city,
      plan: b.plan,
      ownerName: b.owner.name,
      ownerPhone: b.owner.phone,
      createdAt: b.createdAt,
      access: accessOf(
        {
          createdAt: b.createdAt,
          suspendedAt: b.suspendedAt,
          exemptFromRules: b.exemptFromRules,
          latest,
        },
        settings,
        now
      ),
      latest,
    };
  });
}

/** "+251 91 234 5678" from the stored 9 digits. */
export const formatPhone = (phone: string) =>
  `+251 ${phone.slice(0, 2)} ${phone.slice(2, 5)} ${phone.slice(5)}`;

/** A CSV cell: quoted, inner quotes doubled, and no formula injection in spreadsheets. */
export const csvCell = (value: unknown) => {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

export const startOfMonth = (date: Date, monthsBack = 0) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - monthsBack, 1));

/** Midnight in Addis Ababa (UTC+3), as a UTC instant. */
export function startOfAddisDay(now = new Date()) {
  const addis = new Date(now.getTime() + 3 * 3_600_000);
  return new Date(
    Date.UTC(addis.getUTCFullYear(), addis.getUTCMonth(), addis.getUTCDate()) - 3 * 3_600_000
  );
}
