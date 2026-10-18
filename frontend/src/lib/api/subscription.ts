import type { BillingPeriod, Plan, Subscription } from '@/store/session';

import type { CbeCheck } from '@/lib/mock/verification';

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

/** Where to pay for a plan (Smart Verify's CBE account) and the prices. */
export interface PaymentInfo {
  bank: 'CBE';
  accountNumber: string;
  accountName: string;
  prices: { normal: { monthly: number; quarterly: number }; restaurant: { monthly: number } };
}

/** GET /subscription/payment-info — owner only. */
export const getPaymentInfo = () => api<PaymentInfo>('/subscription/payment-info');

/** POST /subscription/pay — checks the CBE receipt link and starts the plan when it passes. */
export const payForPlan = (
  plan: Plan,
  period: BillingPeriod,
  url: string,
  idempotencyKey = newIdempotencyKey()
) =>
  api<{ check: CbeCheck; subscription: Subscription | null }>('/subscription/pay', {
    method: 'POST',
    body: { plan, period, url },
    idempotencyKey,
    timeoutMs: 30_000,
  });
