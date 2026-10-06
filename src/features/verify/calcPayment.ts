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
