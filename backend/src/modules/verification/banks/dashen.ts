import type { ParsedReceipt, ReceiptParser } from './types.js';

/** Addis Ababa is UTC+3 all year (no daylight saving). */
const ADDIS_OFFSET_HOURS = 3;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

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

const keyOf = (label: string) => label.replace(/:/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Label → value from the receipt page: header fields are <p><strong>Label:</strong> value</p>,
 * amounts are table rows <td>Label</td><td>value</td>.
 */
function fieldsOf(html: string): Map<string, string> {
  const body = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  const map = new Map<string, string>();
  for (const m of body.matchAll(/<strong>([\s\S]*?)<\/strong>([\s\S]*?)<\/p>/gi)) {
    const key = keyOf(textOf(m[1] ?? ''));
    if (key && !map.has(key)) map.set(key, textOf(m[2] ?? ''));
  }
  for (const m of body.matchAll(
    /<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/gi
  )) {
    const key = keyOf(textOf(m[1] ?? ''));
    if (key && !map.has(key)) map.set(key, textOf(m[2] ?? ''));
  }
  return map;
}

/** "Oct 14, 2026, 09:23:02 am" (Addis Ababa time) → Date. */
function addisDate(text: string): Date | null {
  const m =
    /([A-Za-z]{3})[a-z]*\s+(\d{1,2}),?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i.exec(
      text
    );
  if (!m) return null;
  const [, mon = '', day, year, hour, minute, second, ampm] = m;
  const month = MONTHS.indexOf(mon.toLowerCase());
  if (month < 0) return null;
  let h = Number(hour);
  if (ampm) h = (h % 12) + (ampm.toLowerCase() === 'pm' ? 12 : 0);
  const date = new Date(
    Date.UTC(
      Number(year),
      month,
      Number(day),
      h - ADDIS_OFFSET_HOURS,
      Number(minute),
      Number(second ?? 0)
    )
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Dashen Bank receipt page (receipts.dashenbanksc.com/receipt/<FT Ref>), as checked against a
 * real one. Accounts are masked by the bank to the first 4 and last 3 digits (2926******311).
 * There is no status line: the page exists only for completed transfers (an unknown reference
 * gets 400 "Transaction not found").
 */
export const dashenParser: ReceiptParser = {
  parse(html) {
    const f = fieldsOf(html);
    const get = (label: string) => f.get(label) ?? '';

    const reference = get('transaction reference').toUpperCase();
    const date = addisDate(get('transaction date'));
    const amount = /ETB\s*([\d,]+(?:\.\d+)?)/i.exec(get('transaction amount'));
    const receiverName = get('receiver name');
    // A Telebirr transfer shows the wallet phone as "+251******175".
    const receiverAccount = get('receiver account number').replace(/[\s+]/g, '');
    if (!/^[A-Z0-9]{10,24}$/.test(reference) || !date || !amount?.[1]) return null;
    if (!receiverName || !/^\d+\*+\d+$/.test(receiverAccount)) return null;
    const toTelebirr = /telebirr/i.test(`${get('service type')} ${get('narrative')}`);
    const value = Number(amount[1].replace(/,/g, ''));
    if (!Number.isFinite(value)) return null;

    return {
      payerName: get('sender name'),
      payerAccount: get('sender account number'),
      receiverName,
      receiverAccount,
      amountEtb: Math.floor(value),
      currency: 'ETB',
      date,
      reference,
      status: 'COMPLETED',
      transfer: toTelebirr ? 'wallet' : 'masked_account',
      reason: get('narrative') || get('service type'),
      destinationAccount: '',
      // Which bank received it; Dashen to Dashen says "Dashen Bank".
      destinationBank: get('beneficiary bank name') || get('institution name'),
    } satisfies ParsedReceipt;
  },
};
