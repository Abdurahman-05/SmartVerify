import type { PaymentInfo } from '@/lib/api/subscription';
import type { BillingPeriod, Plan, Subscription } from '@/store/session';

import { startSubscription } from './subscription';
import { mockDelay } from './mock';

/** Offline: a made-up Smart Verify account. */
export async function getPaymentInfo(): Promise<PaymentInfo> {
  await mockDelay(300);
  return {
    bank: 'CBE',
    accountNumber: '1000000000000',
    accountName: 'Smart Verify (offline)',
    prices: { normal: { monthly: 700, quarterly: 1500 }, restaurant: { monthly: 4000 } },
  };
}

/** Offline: every receipt pays; the plan starts like before. */
export async function payForPlan(plan: Plan, period: BillingPeriod, _url: string) {
  const subscription: Subscription = await startSubscription(plan, period);
  return {
    check: {
      status: 'verified' as const,
      reference: 'FT00000MOCK0',
      amountEtb: subscription.priceEtb,
      extraEtb: 0,
      payerName: '',
      receiverName: '',
      date: new Date().toISOString(),
    },
    subscription,
  };
}
