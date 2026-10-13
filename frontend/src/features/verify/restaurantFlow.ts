import { create } from 'zustand';

import { useBills } from '@/features/bills/store';
import type { Bill } from '@/features/bills/types';
import { usePayments } from '@/features/payments/store';
import type { ExtraChoice } from '@/lib/api/payments';
import { payBill, USE_MOCK_BILLS } from '@/lib/bills';
import type { BankCheckSimulation } from '@/lib/mock/verify';
import { refreshAfterPayment } from '@/lib/queryClient';

import { calcPayment, type PaymentCalc } from './calcPayment';

export type RestaurantMethod = 'bank' | 'cash+bank';

export interface PaymentOutcome extends PaymentCalc {
  billId: string;
  method: RestaurantMethod;
  total: number;
  cash: number;
  received: number;
  /** Extra given back to the customer from the cash drawer (instead of a tip). */
  change: number;
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

/**
 * Adds the newly received bank money, then closes the bill or keeps it open if short.
 * With the backend, the server adds up the scans and decides; pass the same key when retrying
 * the same scan so it is counted once.
 */
export async function settlePayment(
  bill: Bill,
  newlyReceived: number,
  idempotencyKey: string,
  extraChoice: ExtraChoice = 'tip'
): Promise<PaymentOutcome> {
  const { method, cash: cashInput, bankReceived } = useRestaurantPay.getState();
  const cash = cashFor(method, cashInput);

  if (!USE_MOCK_BILLS) {
    const res = await payBill(
      bill.id,
      method === 'bank'
        ? { method, bankReceivedEtb: newlyReceived, extraChoice }
        : { method, cashEtb: cash, bankReceivedEtb: newlyReceived, extraChoice },
      idempotencyKey
    );
    const outcome: PaymentOutcome = {
      billId: bill.id,
      method,
      total: res.totalEtb,
      cash: res.cashEtb,
      received: res.bankReceivedEtb,
      expectedBank: res.expectedBankEtb,
      status: res.status,
      remaining: res.remainingEtb,
      tip: res.tipEtb,
      change: res.changeEtb,
    };
    useRestaurantPay.setState({
      bankReceived: res.status === 'short' ? res.bankReceivedEtb : 0,
      outcome,
    });
    refreshAfterPayment();
    return outcome;
  }

  const received = bankReceived + newlyReceived;
  const raw = calcPayment({ total: bill.total, cash, received });
  const giveBack = extraChoice === 'giveback' ? raw.tip : 0;
  const calc = { ...raw, tip: raw.tip - giveBack };
  const outcome: PaymentOutcome = {
    ...calc,
    change: giveBack,
    billId: bill.id,
    method,
    total: bill.total,
    cash,
    received,
  };

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
