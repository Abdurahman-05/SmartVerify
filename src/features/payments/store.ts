import { create } from 'zustand';

import type { Payment } from './types';

interface PaymentsState {
  payments: Payment[];
  addPayment: (payment: Payment) => void;
}

export const usePayments = create<PaymentsState>((set) => ({
  payments: [],
  addPayment: (payment) => set((s) => ({ payments: [...s.payments, payment] })),
}));
