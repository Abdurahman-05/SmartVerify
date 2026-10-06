import { create } from 'zustand';

import { useBills } from '@/features/bills/store';
import type { Bill } from '@/features/bills/types';
import { usePayments } from '@/features/payments/store';
import type { BankCheckSimulation } from '@/lib/mock/verify';

import { calcPayment, type PaymentCalc } from './calcPayment';

export type RestaurantMethod = 'bank' | 'cash+bank';

export interface PaymentOutcome extends PaymentCalc {
  billId: string;
  method: RestaurantMethod;
  total: number;
  cash: number;
  received: number;
}

interface RestaurantPayState {
  billId: string | null;
  method: RestaurantMethod;
  cash: number;
  /** Bank money already received for this bill across scans (short payments). */
  bankReceived: number;
  simulate: BankCheckSimulation;
  outcome: PaymentOutcome | null;
  start: (billId: string) => void;
  setMethod: (method: RestaurantMethod) => void;
  setCash: (cash: number) => void;
  setSimulate: (simulate: BankCheckSimulation) => void;
  reset: () => void;
}

const initial = {
  billId: null,
  method: 'bank' as RestaurantMethod,
  cash: 0,
  bankReceived: 0,
  simulate: 'exact' as BankCheckSimulation,
  outcome: null,
};

export const useRestaurantPay = create<RestaurantPayState>((set) => ({
  ...initial,
  start: (billId) => set({ ...initial, billId }),
  setMethod: (method) => set({ method }),
  setCash: (cash) => set({ cash }),
  setSimulate: (simulate) => set({ simulate }),
  reset: () => set(initial),
}));

export const cashFor = (method: RestaurantMethod, cash: number) => (method === 'bank' ? 0 : cash);

/** Adds the newly received bank money, then closes the bill or keeps it open if short. */
export function settlePayment(bill: Bill, newlyReceived: number): PaymentOutcome {
  const { method, cash: cashInput, bankReceived } = useRestaurantPay.getState();
  const cash = cashFor(method, cashInput);
  const received = bankReceived + newlyReceived;
  const calc = calcPayment({ total: bill.total, cash, received });
  const outcome: PaymentOutcome = { ...calc, billId: bill.id, method, total: bill.total, cash, received };

  if (calc.status === 'short') {
    useRestaurantPay.setState({ bankReceived: received, outcome });
    return outcome;
  }

  useBills.getState().markPaid(bill.id);
  usePayments.getState().addPayment({
    id: `pay-${Date.now()}`,
    billId: bill.id,
    method,
    cash,
    bank: received,
    tip: calc.tip,
    waiterId: bill.waiterId,
    waiterName: bill.waiterName,
    createdAt: new Date().toISOString(),
  });
  useRestaurantPay.setState({ bankReceived: 0, outcome });
  return outcome;
}
