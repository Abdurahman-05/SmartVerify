import type { ParsedReceipt } from './banks/types.js';

export type MismatchReason =
  'WRONG_RECEIVER' | 'WRONG_RECEIVER_NAME' | 'AMOUNT_TOO_LOW' | 'NOT_SUCCESS' | 'EXPIRED';

/** A receiving account of the business (full number stays on the server). */
export interface OwnAccount {
  bankCode: string;
  accountNumber: string;
  last4: string;
  holderName: string | null;
}

export interface CompareInput {
  expectedAmountEtb: number;
  accounts: OwnAccount[];
  /** Name to expect when an account has no holder name (accounts saved before it was asked). */
  businessName: string;
  now: Date;
  maxAgeHours: number;
}

export type CompareResult =
  { ok: true; extraEtb: number } | { ok: false; reasons: MismatchReason[] };

const SUCCESS = /^(success|successful|completed)$/i;
const HOUR_MS = 60 * 60 * 1000;

const words = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

/**
 * The receipt name is the saved name, or contains all of its words (receipts may add a
 * grandfather's name). One word alone is too weak to count.
 */
export function sameName(receiptName: string, savedName: string) {
  const got = words(receiptName);
  const want = words(savedName);
  if (!want.length) return false;
  if (got.join(' ') === want.join(' ')) return true;
  return want.length >= 2 && want.every((w) => got.includes(w));
}

/**
 * Where the money went, against our accounts.
 * CBE to CBE: receiver account last 4 is one of our CBE accounts, and the receiver name matches
 * that account's holder. CBE to another bank: the destination account in the reason is the full
 * number of one of our accounts at another bank.
 */
function receiverCheck(receipt: ParsedReceipt, input: CompareInput) {
  if (receipt.transfer === 'other_bank') {
    const dest = receipt.destinationAccount;
    const ok =
      dest.length >= 8 &&
      input.accounts.some((a) => a.bankCode !== 'CBE' && a.accountNumber === dest);
    return { account: ok, name: true, shown: dest.slice(-4) };
  }
  const last4 = receipt.receiverAccount.replace(/\D/g, '').slice(-4);
  const matches = input.accounts.filter((a) => a.bankCode === 'CBE' && a.last4 === last4);
  const account = last4.length === 4 && matches.length > 0;
  const name = matches.some((a) =>
    sameName(receipt.receiverName, a.holderName ?? input.businessName)
  );
  return { account, name: !account || name, shown: last4 };
}

/** Deterministic checks of a parsed receipt against what the business expects. */
export function compareReceipt(receipt: ParsedReceipt, input: CompareInput): CompareResult {
  const reasons: MismatchReason[] = [];

  const receiver = receiverCheck(receipt, input);
  if (!receiver.account) reasons.push('WRONG_RECEIVER');
  else if (!receiver.name) reasons.push('WRONG_RECEIVER_NAME');
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
 * No names or full account numbers: they are personal data; last 4 digits are enough to see why.
 */
export function explainComparison(receipt: ParsedReceipt, input: CompareInput) {
  const receiver = receiverCheck(receipt, input);
  const ageHours = (input.now.getTime() - receipt.date.getTime()) / HOUR_MS;
  const round = (n: number) => Math.round(n * 10) / 10;
  const mark = (ok: boolean) => (ok ? 'OK' : 'FAIL');
  const checks = {
    receiverAccount: receiver.account,
    receiverName: receiver.name,
    amount: receipt.currency === 'ETB' && receipt.amountEtb >= input.expectedAmountEtb,
    status: SUCCESS.test(receipt.status),
    date: ageHours <= input.maxAgeHours,
  };
  const otherBank = receipt.transfer === 'other_bank';
  const ours = (filter: (a: OwnAccount) => boolean) => {
    const list = input.accounts.filter(filter).map((a) => `...${a.last4}`);
    return list.length ? list.join(', ') : 'none saved';
  };
  const receiverLines = otherBank
    ? [
        `CBE -> other bank: destination account in reason ...${receiver.shown || '(none)'} ` +
          `in our other-bank accounts [${ours((a) => a.bankCode !== 'CBE')}] ${mark(receiver.account)}`,
      ]
    : [
        `CBE -> CBE: receiver account ...${receiver.shown} in our CBE accounts ` +
          `[${ours((a) => a.bankCode === 'CBE')}] ${mark(receiver.account)}`,
        `receiver name matches the saved holder name ${receiver.account ? mark(receiver.name) : '(skipped)'}`,
      ];
  return {
    checks,
    fields: {
      reference: receipt.reference,
      transfer: receipt.transfer,
      receiverLast4: receiver.shown,
      receiptAmountEtb: receipt.amountEtb,
      currency: receipt.currency,
      expectedAmountEtb: input.expectedAmountEtb,
      bankStatus: receipt.status,
      paidAtAddis: addis(receipt.date),
      ageHours: round(ageHours),
      maxAgeHours: input.maxAgeHours,
    },
    lines: [
      ...receiverLines,
      `amount ${receipt.amountEtb} ${receipt.currency} >= ${input.expectedAmountEtb} ETB ${mark(checks.amount)}`,
      `bank status "${receipt.status}" is success ${mark(checks.status)}`,
      `paid ${addis(receipt.date)} Addis, ${round(ageHours)}h ago <= ${input.maxAgeHours}h ${mark(checks.date)}`,
    ],
  };
}
