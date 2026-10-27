import * as real from '@/lib/api/subscription';
import * as mock from '@/lib/mock/subscription';
import * as mockPay from '@/lib/mock/subscriptionPay';
import type { Plan } from '@/store/session';

/** EXPO_PUBLIC_USE_MOCK_SUBSCRIPTION=true uses the offline mock; default is the real backend. */
export const USE_MOCK_SUBSCRIPTION = process.env.EXPO_PUBLIC_USE_MOCK_SUBSCRIPTION === 'true';

export const startSubscription = USE_MOCK_SUBSCRIPTION
  ? mock.startSubscription
  : real.startSubscription;
// The mock keeps the plan only in the app, so exploring needs no call.
export const explorePlan: (plan: Plan) => Promise<void> = USE_MOCK_SUBSCRIPTION
  ? async () => {}
  : real.explorePlan;

export type { PaymentInfo } from '@/lib/api/subscription';
export const getPaymentInfo = USE_MOCK_SUBSCRIPTION ? mockPay.getPaymentInfo : real.getPaymentInfo;
// The offline mock ignores the receipt, so it accepts every way to pay.
export const payForPlan: typeof real.payForPlan = USE_MOCK_SUBSCRIPTION
  ? (plan, period) => mockPay.payForPlan(plan, period, { url: '' })
  : real.payForPlan;
