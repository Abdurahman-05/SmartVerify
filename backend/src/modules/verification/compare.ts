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

/** Addis Ababa time for logs, e.g. "2026-10-13 12:15". */
const addis = (date: Date) =>
  new Date(date.getTime() + 3 * HOUR_MS).toISOString().slice(0, 16).replace('T', ' ');

/**
 * One line per check, for the server log: what the receipt says, what we expected, OK / FAIL.
 * No names: they are personal data and not needed to see why a check failed.
 */
export function explainComparison(receipt: ParsedReceipt, input: CompareInput) {
  const receiverLast4 = receipt.receiverAccount.replace(/\D/g, '').slice(-4);
  const ageHours = (input.now.getTime() - receipt.date.getTime()) / HOUR_MS;
  const mark = (ok: boolean) => (ok ? 'OK' : 'FAIL');
  const checks = {
    receiver: receiverLast4.length === 4 && input.accountLast4s.includes(receiverLast4),
    amount: receipt.currency === 'ETB' && receipt.amountEtb >= input.expectedAmountEtb,
    status: SUCCESS.test(receipt.status),
    date: ageHours <= input.maxAgeHours,
  };
  const ours = input.accountLast4s.length ? input.accountLast4s.join(', ') : 'none saved';
  return {
    checks,
    fields: {
      reference: receipt.reference,
      receiverLast4,
      ourCbeAccountsLast4: input.accountLast4s,
      receiptAmountEtb: receipt.amountEtb,
      currency: receipt.currency,
      expectedAmountEtb: input.expectedAmountEtb,
      bankStatus: receipt.status,
      paidAtAddis: addis(receipt.date),
      ageHours: Math.round(ageHours * 10) / 10,
      maxAgeHours: input.maxAgeHours,
    },
    lines: [
      `receiver account ...${receiverLast4} in our CBE accounts [${ours}] ${mark(checks.receiver)}`,
      `amount ${receipt.amountEtb} ${receipt.currency} >= ${input.expectedAmountEtb} ETB ${mark(checks.amount)}`,
      `bank status "${receipt.status}" is success ${mark(checks.status)}`,
      `paid ${addis(receipt.date)} Addis, ${Math.round(ageHours * 10) / 10}h ago <= ${input.maxAgeHours}h ${mark(checks.date)}`,
    ],
  };
}
