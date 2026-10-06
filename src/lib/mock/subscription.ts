import { periodMonths, priceFor } from '@/features/subscription/plans';
import type { BillingPeriod, Plan, Subscription } from '@/store/session';

import { mockDelay } from './mock';

/** Mock: starts the plan right away. Payment will be added before this goes live. */
export async function startSubscription(plan: Plan, period: BillingPeriod): Promise<Subscription> {
  await mockDelay(1500);
  const startedAt = new Date();
  const endsAt = new Date(startedAt);
  endsAt.setMonth(endsAt.getMonth() + (plan === 'restaurant' ? 1 : periodMonths(period)));
  return {
    plan,
    period: plan === 'restaurant' ? 'monthly' : period,
    priceEtb: priceFor(plan, period),
    startedAt: startedAt.toISOString(),
    endsAt: endsAt.toISOString(),
  };
}
