import type { ParsedReceipt, ReceiptParser } from './types.js';

/** Addis Ababa is UTC+3 all year (no daylight saving). */
const ADDIS_OFFSET_HOURS = 3;

/** The page Awash answers (HTTP 200) for a token it does not know. */
export const AWASH_NOT_FOUND = /receipt not found/i;

/**
 * Where each field is on the receipt page (awashpay.awashbank.com:8225/<token>), as checked
 * against a real one. Every field is a table row of three cells: label, ":", value, e.g.
 *   <tr><td><tt><span>Amount </span></tt></td><td><tt><span>: </span></tt></td>
 *       <td><tt><span>13 ETB</span></tt></td></tr>
 * Only rows after SECTION are read: the top tables (Company / Customer Information) reuse labels
 * such as "Account No" for Awash itself and the sender.
 */
export const AWASH_SELECTORS = {
  /** <title>: "Transaction Successful" for a completed transfer. */
  title: /<title>([\s\S]*?)<\/title>/i,
  /** The heading above the transaction table. */
  section: /Transaction\/Payment Information/i,
  /** One label / ":" / value row. */
  row: /<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/gi,
  labels: {
    /** "2026-11-12 08:22:41 AM", Addis Ababa time. */
    time: 'transaction time',
    /** "IPS Bank Transfer" (to another bank), kept as the reason line. */
    type: 'transaction type',
    /** "13 ETB" (may have commas and cents). */
    amount: 'amount',
    /** The customer who paid (from Awash). */
    senderName: 'sender name',
    /** Masked by the bank, e.g. 25190****175. */
    senderAccount: 'sender account',
    /** The restaurant's account holder as the receiving bank knows it. */
    beneficiaryName: 'beneficiary name',
    /** In full (1000529213267) or masked (1000*****3267). */
    beneficiaryAccount: 'beneficiary account',
    /** "Commercial Bank of Ethiopia", "Awash Bank", ... (mapped to our bank codes). */
    beneficiaryBank: 'beneficiary bank',
    /** The sender's note. */
    reason: 'reason',
    /** Awash's transaction number, e.g. 261112082263115. */
    transactionId: 'transaction id',
  },
} as const;

/** Bank name as Awash prints it → our bank code. Unknown banks give '' (never matches). */
const BANK_CODES: [RegExp, string][] = [
  [/commercial bank of ethiopia|^cbe\b/i, 'CBE'],
  [/awash/i, 'AWA'],
  [/dashen/i, 'DAS'],
  [/abyssinia|^boa\b/i, 'BOA'],
  [/\babay\b/i, 'ABY'],
  [/wegagen/i, 'WEG'],
  [/hibret|united bank/i, 'HIB'],
  [/\bnib\b/i, 'NIB'],
  [/cooperative bank of oromia|\bcoop\b/i, 'COO'],
  [/zemen/i, 'ZEM'],
  [/telebirr/i, 'TEL'],
  [/e-?birr/i, 'EBR'],
  [/m-?pesa|safaricom/i, 'MPE'],
];

export const awashBankCode = (name: string) =>
  BANK_CODES.find(([pattern]) => pattern.test(name.trim()))?.[1] ?? '';

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

const textOf = (fragment: string) =>
  fragment
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (e) => ENTITIES[e] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Label (lower case) → value, from the rows of the transaction table. */
function fieldsOf(html: string): Map<string, string> {
  const body = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  const start = body.search(AWASH_SELECTORS.section);
  const map = new Map<string, string>();
  if (start < 0) return map;
  for (const m of body.slice(start).matchAll(AWASH_SELECTORS.row)) {
    const key = textOf(m[1] ?? '').toLowerCase();
    if (key && textOf(m[2] ?? '') === ':' && !map.has(key)) map.set(key, textOf(m[3] ?? ''));
  }
  return map;
}

/** "2026-11-12 08:22:41 AM" (Addis Ababa time) → Date. */
function addisDate(text: string): Date | null {
  const m = /(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i.exec(text);
  if (!m) return null;
  const [, year, month, day, hour, minute, second, ampm] = m;
  let h = Number(hour);
  if (ampm) h = (h % 12) + (ampm.toLowerCase() === 'pm' ? 12 : 0);
  const date = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      h - ADDIS_OFFSET_HOURS,
      Number(minute),
      Number(second ?? 0)
    )
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Awash receipt page (from the "Receipt Link" in Awash's SMS). It is the SENDER's receipt: the
 * customer paid from Awash to the restaurant's account at any bank. `reference` is Awash's
 * Transaction ID; the service adds the link token to it.
 */
export const awashParser: ReceiptParser = {
  parse(html) {
    const f = fieldsOf(html);
    const label = AWASH_SELECTORS.labels;
    const get = (key: keyof typeof label) => f.get(label[key]) ?? '';

    const reference = get('transactionId');
    const date = addisDate(get('time'));
    const amount = /^([\d,]+(?:\.\d+)?)\s*ETB$/i.exec(get('amount'));
    const receiverName = get('beneficiaryName');
    const receiverAccount = get('beneficiaryAccount').replace(/\s/g, '');
    const bankName = get('beneficiaryBank');
    if (!/^[A-Z0-9]{8,32}$/i.test(reference) || !date || !amount?.[1]) return null;
    if (!receiverName || !/^[\d*]{6,}$/.test(receiverAccount) || !bankName) return null;
    const value = Number(amount[1].replace(/,/g, ''));
    if (!Number.isFinite(value)) return null;
    const title = textOf(AWASH_SELECTORS.title.exec(html)?.[1] ?? '');

    return {
      payerName: get('senderName'),
      payerAccount: get('senderAccount'),
      receiverName,
      receiverAccount,
      amountEtb: Math.floor(value),
      currency: 'ETB',
      date,
      reference: reference.toUpperCase(),
      status: /^transaction successful$/i.test(title) ? 'SUCCESS' : title || 'UNKNOWN',
      transfer: 'awash',
      reason: get('reason') || get('type'),
      destinationAccount: '',
      // Our bank code for the receiving bank ('' when we do not know the bank).
      destinationBank: awashBankCode(bankName),
    } satisfies ParsedReceipt;
  },
};
