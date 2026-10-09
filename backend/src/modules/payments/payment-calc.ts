/**
 * Restaurant payment rules (integer ETB). Same rules as the app's src/features/verify/calcPayment.ts;
 * the server must run these itself and never trust totals sent by the client.
 */

export type PaymentStatus = 'paid' | 'short' | 'over';

export interface PaymentCalc {
  expectedBank: number;
  status: PaymentStatus;
  remaining: number;
  tip: number;
}

/** Bank only (cash = 0) or cash + bank. `received` is the sum of all bank scans for the bill. */
export function calcPayment({
  total,
  cash = 0,
  received,
}: {
  total: number;
  cash?: number;
  received: number;
}): PaymentCalc {
  assertEtb(total, cash, received);
  if (cash >= total) throw new RangeError('cash covers the whole bill: use calcCash');
  const expectedBank = total - cash;
  if (received === expectedBank) return { expectedBank, status: 'paid', remaining: 0, tip: 0 };
  if (received > expectedBank)
    return { expectedBank, status: 'over', remaining: 0, tip: received - expectedBank };
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

/** Cash only. Extra money is the waiter's tip or change given back. */
export function calcCash({
  total,
  cash,
  extraChoice,
}: {
  total: number;
  cash: number;
  extraChoice: ExtraChoice;
}): CashCalc {
  assertEtb(total, cash);
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

/** Bill total is always food + packing + delivery (also enforced by a database CHECK). */
export const billTotal = (foodTotal: number, packingFee: number, deliveryFee: number) => {
  assertEtb(foodTotal, packingFee, deliveryFee);
  return foodTotal + packingFee + deliveryFee;
};

function assertEtb(...values: number[]) {
  for (const v of values) {
    if (!Number.isSafeInteger(v) || v < 0)
      throw new RangeError('amounts must be non-negative integer ETB');
  }
}
