import type {
  BillingPeriod,
  Plan,
  Prisma,
  PrismaClient,
  Subscription,
} from '../generated/prisma/client.js';

import { accessOf, type AccessInfo } from './lifecycle.js';
import { addMonths, getSettings } from './platform-settings.js';

/** The business's latest real period (the newest end), whatever paid for it. */
export const latestSubscription = (
  prisma: PrismaClient | Prisma.TransactionClient,
  businessId: string
) =>
  prisma.subscription.findFirst({
    where: { businessId, status: { not: 'cancelled' } },
    orderBy: { endsAt: 'desc' },
  });

/** Where this business is now: trial, active, grace, restricted or suspended. */
export async function businessAccess(
  prisma: PrismaClient,
  businessId: string,
  now = new Date()
): Promise<AccessInfo> {
  const [business, latest, settings] = await Promise.all([
    prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { createdAt: true, suspendedAt: true, exemptFromRules: true },
    }),
    latestSubscription(prisma, businessId),
    getSettings(prisma),
  ]);
  return accessOf({ ...business, latest }, settings, now);
}

/**
 * The same, remembered for 30 seconds per business: checked on every business request, so it
 * must not cost database round trips each time. Anything that changes it calls forgetAccess.
 */
const ACCESS_TTL_MS = 30_000;
const accessCache = new Map<string, { at: number; access: AccessInfo }>();

export async function cachedBusinessAccess(
  prisma: PrismaClient,
  businessId: string
): Promise<AccessInfo> {
  const hit = accessCache.get(businessId);
  if (hit && Date.now() - hit.at < ACCESS_TTL_MS) return hit.access;
  const access = await businessAccess(prisma, businessId);
  accessCache.set(businessId, { at: Date.now(), access });
  return access;
}

/** A payment, an admin action or new rules: the next request sees the new status at once. */
export function forgetAccess(businessId?: string) {
  if (businessId) accessCache.delete(businessId);
  else accessCache.clear();
}

/**
 * Starts a paid period. Paying early adds on top of the time left; paying late starts today.
 * The business gets the plan at once. Runs inside the caller's transaction.
 */
export async function startPaidPeriod(
  tx: Prisma.TransactionClient,
  input: {
    businessId: string;
    plan: Plan;
    period: BillingPeriod;
    priceEtb: number;
    months: number;
    paymentMethod: 'cbe' | 'telebirr' | 'manual' | 'free';
    paymentReference?: string | null;
    idempotencyKey?: string | null;
    note?: string | null;
  },
  now = new Date()
): Promise<Subscription> {
  const current = await latestSubscription(tx, input.businessId);
  const startedAt =
    current && current.endsAt > now && current.paymentMethod !== 'trial' ? current.endsAt : now;
  await tx.business.update({ where: { id: input.businessId }, data: { plan: input.plan } });
  return tx.subscription.create({
    data: {
      businessId: input.businessId,
      plan: input.plan,
      period: input.period,
      priceEtb: input.priceEtb,
      startedAt,
      endsAt: addMonths(startedAt, input.months),
      paymentMethod: input.paymentMethod,
      paymentReference: input.paymentReference ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      note: input.note ?? null,
    },
  });
}
