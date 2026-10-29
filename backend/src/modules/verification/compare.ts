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

/** Letters to add, remove or change to turn one word into the other. */
function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (row[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = row;
  }
  return prev[b.length] ?? 0;
}

/**
 * Spelling differences of the same name (Mohammed / Mohamed / Muhammed, Elias / Eliyas,
 * Abdurahman / Abdulrahman, Hussen / Husein / Hussien): one letter in a word of 4–5 letters, two
 * in 6–8, three in a longer word. Short words must be equal.
 */
const similar = (a: string, b: string) => {
  if (a === b) return true;
  const shorter = Math.min(a.length, b.length);
  if (shorter < 4) return false;
  return editDistance(a, b) <= (shorter >= 9 ? 3 : shorter >= 6 ? 2 : 1);
};

/** A receipt that cuts the name off: its last word is the start of the saved word. */
const cutOff = (got: string, want: string) => got.length >= 3 && want.startsWith(got);

/**
 * The receipt name is the saved name, or contains all of its words (receipts may add a
 * grandfather's name), allowing small spelling differences. Words written together or apart
 * ("Abdurahman" / "Abdu Rahman") match too. One word alone is too weak to count. The account is
 * always checked separately and exactly, so this only decides "right name for that account".
 */
export function sameName(receiptName: string, savedName: string) {
  const got = words(receiptName);
  const want = words(savedName);
  if (!want.length) return false;
  if (got.join(' ') === want.join(' ')) return true;
  if (want.length < 2) return false;
  const last = got[got.length - 1] ?? '';
  if (want.every((w) => got.some((g) => similar(g, w) || (g === last && cutOff(g, w))))) {
    return true;
  }
  // Same letters with the spaces in other places: compare the joined names.
  const joinedWant = want.join('');
  const joinedGot = got.join('');
  if (joinedGot.startsWith(joinedWant) || joinedWant === joinedGot) return true;
  if (joinedWant.length < 8) return false;
  // The receipt may add words after the name: compare with its best-fitting beginning.
  const allowed = Math.max(2, Math.floor(joinedWant.length / 6));
  for (let n = joinedWant.length - allowed; n <= joinedWant.length + allowed; n++) {
    if (
      n > 0 &&
      n <= joinedGot.length &&
      editDistance(joinedGot.slice(0, n), joinedWant) <= allowed
    ) {
      return true;
    }
  }
  return false;
}

/**
 * A printed account against a saved full number: equal when printed in full; when masked
 * (2********1611), the first digit and the last 4 must match.
 */
function sameAccount(printed: string, saved: string) {
  if (!printed.includes('*')) return printed.length >= 8 && printed === saved;
  const last4 = printed.slice(-4);
  return /^\d{4}$/.test(last4) && printed[0] === saved[0] && saved.endsWith(last4);
}

/**
 * An account printed with its middle hidden (2926******311) against a saved full number: same
 * length, same first and last digits.
 */
function sameMaskedAccount(printed: string, saved: string) {
  const m = /^(\d+)(\*+)(\d+)$/.exec(printed);
  if (!m?.[1] || !m[3]) return false;
  return saved.length === printed.length && saved.startsWith(m[1]) && saved.endsWith(m[3]);
}

/** A phone as Telebirr prints it (2519****8175) against a saved 09xxxxxxxx / 07xxxxxxxx. */
function samePhone(printed: string, saved: string) {
  const intl = `251${saved.replace(/^0/, '')}`;
  if (!printed.includes('*')) return printed === intl;
  return (
    printed.length >= 8 && intl.startsWith(printed.slice(0, 4)) && intl.endsWith(printed.slice(-4))
  );
}

/**
 * Where the money went, against our accounts.
 * CBE to CBE: receiver account last 4 is one of our CBE accounts, and the receiver name matches
 * that account's holder. CBE to another bank: the destination account in the reason is the full
 * number of one of our accounts at another bank.
 */
function receiverCheck(receipt: ParsedReceipt, input: CompareInput) {
  const nameOf = (a: OwnAccount) => a.holderName ?? input.businessName;
  if (receipt.transfer === 'wallet') {
    // 2519****8175 against a saved Telebirr number 09xxxx8175 (as 2519xxxx8175).
    const printed = receipt.receiverAccount.replace(/[^0-9*]/g, '');
    const matches = input.accounts.filter(
      (a) => a.bankCode === 'TEL' && samePhone(printed, a.accountNumber)
    );
    const account = matches.length > 0;
    const name = matches.some((a) => sameName(receipt.receiverName, nameOf(a)));
    return { account, name: !account || name, shown: printed.slice(-4) };
  }
  if (receipt.transfer === 'masked_account') {
    // Dashen: 2926******311 against our saved accounts, at Dashen when it went to Dashen.
    const printed = receipt.receiverAccount;
    const dashen = /dashen/i.test(receipt.destinationBank ?? '');
    const matches = input.accounts.filter(
      (a) =>
        (dashen ? a.bankCode === 'DAS' : a.bankCode !== 'TEL') &&
        sameMaskedAccount(printed, a.accountNumber)
    );
    const account = matches.length > 0;
    const name = matches.some((a) => sameName(receipt.receiverName, nameOf(a)));
    return { account, name: !account || name, shown: printed.slice(-4) };
  }
  if (receipt.transfer === 'ebirr_bank') {
    // 231****31 (first 3 and last 2 digits): the receipt has no holder name, so the account is
    // all there is to check; the printed length must also match.
    const printed = receipt.destinationAccount;
    const account = input.accounts.some(
      (a) =>
        a.bankCode !== 'TEL' && a.bankCode !== 'EBR' && sameMaskedAccount(printed, a.accountNumber)
    );
    return { account, name: true, shown: printed.slice(-2) };
  }
  if (receipt.transfer === 'ebirr_wallet') {
    const printed = receipt.receiverAccount.replace(/\D/g, '');
    const matches = input.accounts.filter(
      (a) => a.bankCode === 'EBR' && samePhone(printed, a.accountNumber)
    );
    const account = matches.length > 0;
    const name = matches.some((a) => sameName(receipt.receiverName, nameOf(a)));
    return { account, name: !account || name, shown: printed.slice(-4) };
  }
  if (receipt.transfer === 'wallet_to_bank') {
    const dest = receipt.destinationAccount;
    const matches = input.accounts.filter((a) => a.bankCode !== 'TEL' && a.accountNumber === dest);
    const account = dest.length >= 8 && matches.length > 0;
    const name = matches.some((a) => sameName(receipt.receiverName, nameOf(a)));
    return { account, name: !account || name, shown: dest.slice(-4) };
  }
  if (receipt.transfer === 'other_bank') {
    const dest = receipt.destinationAccount;
    const ok = input.accounts.some(
      (a) => a.bankCode !== 'CBE' && sameAccount(dest, a.accountNumber)
    );
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
  const wallet = receipt.transfer === 'wallet';
  const walletToBank = receipt.transfer === 'wallet_to_bank';
  const ebirrBank = receipt.transfer === 'ebirr_bank';
  const ebirrWallet = receipt.transfer === 'ebirr_wallet';
  const masked = receipt.transfer === 'masked_account';
  const ours = (filter: (a: OwnAccount) => boolean) => {
    const list = input.accounts.filter(filter).map((a) => `...${a.last4}`);
    return list.length ? list.join(', ') : 'none saved';
  };
  const nameLine = `receiver name matches the saved holder name ${receiver.account ? mark(receiver.name) : '(skipped)'}`;
  const receiverLines = ebirrBank
    ? [
        `eBirr -> bank: account ...${receiver.shown} (printed with its middle hidden) in our ` +
          `bank accounts [${ours((a) => a.bankCode !== 'TEL' && a.bankCode !== 'EBR')}] ${mark(receiver.account)}`,
        'no holder name on this receipt (name check skipped)',
      ]
    : ebirrWallet
      ? [
          `eBirr -> wallet: receiver phone ...${receiver.shown} in our eBirr numbers ` +
            `[${ours((a) => a.bankCode === 'EBR')}] ${mark(receiver.account)}`,
          nameLine,
        ]
      : masked
        ? [
            `${receipt.destinationBank ?? 'bank'}: receiver account ...${receiver.shown} in our ` +
              `accounts [${ours((a) => a.bankCode !== 'TEL')}] ${mark(receiver.account)}`,
            nameLine,
          ]
        : wallet
          ? [
              `Telebirr -> Telebirr: receiver phone ...${receiver.shown} in our Telebirr numbers ` +
                `[${ours((a) => a.bankCode === 'TEL')}] ${mark(receiver.account)}`,
              nameLine,
            ]
          : walletToBank
            ? [
                `Wallet -> bank: bank account ...${receiver.shown} in our bank accounts ` +
                  `[${ours((a) => a.bankCode !== 'TEL')}] ${mark(receiver.account)}`,
                nameLine,
              ]
            : otherBank
              ? [
                  `CBE -> other bank: destination account in reason ...${receiver.shown || '(none)'} ` +
                    `in our other-bank accounts [${ours((a) => a.bankCode !== 'CBE')}] ${mark(receiver.account)}`,
                ]
              : [
                  `CBE -> CBE: receiver account ...${receiver.shown} in our CBE accounts ` +
                    `[${ours((a) => a.bankCode === 'CBE')}] ${mark(receiver.account)}`,
                  nameLine,
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
