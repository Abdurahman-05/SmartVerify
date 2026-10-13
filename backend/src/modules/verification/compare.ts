import type { ParsedReceipt } from './banks/types.js';

export type MismatchReason = 'WRONG_RECEIVER' | 'AMOUNT_TOO_LOW' | 'NOT_SUCCESS' | 'EXPIRED';

export interface CompareInput {
  expectedAmountEtb: number;
  /** Last 4 digits of the business's saved receiving accounts at this bank. */
  accountLast4s: string[];
  now: Date;
  maxAgeHours: number;
}

export type CompareResult =
  { ok: true; extraEtb: number } | { ok: false; reasons: MismatchReason[] };

const SUCCESS = /^(success|successful|completed)$/i;
const HOUR_MS = 60 * 60 * 1000;

/** Deterministic checks of a parsed receipt against what the business expects. */
export function compareReceipt(receipt: ParsedReceipt, input: CompareInput): CompareResult {
  const reasons: MismatchReason[] = [];

  const receiverLast4 = receipt.receiverAccount.replace(/\D/g, '').slice(-4);
  if (receiverLast4.length !== 4 || !input.accountLast4s.includes(receiverLast4)) {
    reasons.push('WRONG_RECEIVER');
  }
  if (receipt.currency !== 'ETB' || receipt.amountEtb < input.expectedAmountEtb) {
    reasons.push('AMOUNT_TOO_LOW');
  }
  if (!SUCCESS.test(receipt.status)) reasons.push('NOT_SUCCESS');
  if (input.now.getTime() - receipt.date.getTime() > input.maxAgeHours * HOUR_MS) {
    reasons.push('EXPIRED');
  }

  return reasons.length
    ? { ok: false, reasons }
    : { ok: true, extraEtb: receipt.amountEtb - input.expectedAmountEtb };
}
