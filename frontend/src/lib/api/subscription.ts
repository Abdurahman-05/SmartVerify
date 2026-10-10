import type { BillingPeriod, Plan, Subscription } from '@/store/session';

import { api } from './client';
import { newIdempotencyKey } from './idempotency';

/** POST /subscription — starts the plan now (no payment step yet). Owner only. */
export const startSubscription = (
  plan: Plan,
  period: BillingPeriod,
  idempotencyKey = newIdempotencyKey()
) => api<Subscription>('/subscription', { method: 'POST', body: { plan, period }, idempotencyKey });

/** PATCH /business/plan — Choose Plan "Explore": saves the plan without a subscription. Owner only. */
export async function explorePlan(plan: Plan): Promise<void> {
  await api('/business/plan', { method: 'PATCH', body: { plan } });
}
