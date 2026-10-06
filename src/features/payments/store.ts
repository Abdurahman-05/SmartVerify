import { create } from 'zustand';

import { useBills } from '@/features/bills/store';
import { useTips } from '@/features/tips/store';
import { billLabel } from '@/features/verify/billLabel';
import i18n from '@/i18n';

import type { Payment } from './types';

interface PaymentsState {
  payments: Payment[];
  addPayment: (payment: Payment) => void;
}

/** Extra money becomes the waiter's tip. Tips are kept apart from sales. */
function recordTip(payment: Payment) {
  if (payment.tip <= 0) return;
  const bill = useBills.getState().bills.find((b) => b.id === payment.billId);
  useTips.getState().addTip({
    id: `tip-${payment.id}`,
    billId: payment.billId,
    label: bill ? billLabel(i18n.t, bill) : '',
    amount: payment.tip,
    source: payment.method === 'cash' ? 'cash' : 'bank',
    waiterId: payment.waiterId,
    createdAt: payment.createdAt,
    paidOut: false,
  });
}

export const usePayments = create<PaymentsState>((set) => ({
  payments: [],
  addPayment: (payment) => {
    set((s) => ({ payments: [...s.payments, payment] }));
    recordTip(payment);
  },
}));
