import { usePayments } from '@/features/payments/store';
import type { Payment } from '@/features/payments/types';

import { mockDelay } from './mock';

export async function createPayment(input: Omit<Payment, 'id'>): Promise<Payment> {
  await mockDelay(300);
  const payment: Payment = { ...input, id: `pay-${Date.now()}` };
  usePayments.getState().addPayment(payment);
  return payment;
}

export async function getPayments(): Promise<Payment[]> {
  await mockDelay(300);
  return usePayments.getState().payments;
}
