export type PaymentStatus = 'paid' | 'short' | 'over';

export interface PaymentCalc {
  expectedBank: number;
  status: PaymentStatus;
  remaining: number;
  tip: number;
}

/**
 * Integer ETB. Bank only: cash = 0.
 * Callers must keep cash below total; cash covering the whole bill is "Cash only".
 */
export function calcPayment({
  total,
  cash = 0,
  received,
}: {
  total: number;
  cash?: number;
  received: number;
}): PaymentCalc {
  const expectedBank = total - cash;
  if (received === expectedBank) return { expectedBank, status: 'paid', remaining: 0, tip: 0 };
  if (received > expectedBank) {
    return { expectedBank, status: 'over', remaining: 0, tip: received - expectedBank };
  }
  return { expectedBank, status: 'short', remaining: expectedBank - received, tip: 0 };
}

export type ExtraChoice = 'tip' | 'giveback';

export interface CashCalc {
  valid: boolean;
  missing: number;
  extra: number;
  tip: number;
  change: number;
}

/** Cash only, integer ETB. Extra money goes to the waiter as a tip or back to the customer. */
export function calcCash({
  total,
  cash,
  extraChoice,
}: {
  total: number;
  cash: number;
  extraChoice: ExtraChoice;
}): CashCalc {
  if (cash < total) return { valid: false, missing: total - cash, extra: 0, tip: 0, change: 0 };
  const extra = cash - total;
  return {
    valid: true,
    missing: 0,
    extra,
    tip: extraChoice === 'tip' ? extra : 0,
    change: extraChoice === 'giveback' ? extra : 0,
  };
}
