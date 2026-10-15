import type { ParsedReceipt, ReceiptParser } from './types.js';

/** Addis Ababa is UTC+3 all year (no daylight saving). */
const ADDIS_OFFSET_HOURS = 3;

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

/** Plain text of an HTML fragment. */
const cellText = (fragment: string) =>
  fragment
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (e) => ENTITIES[e] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** "የከፋይ ስም/Payer Name" → "payer name": labels are Amharic/English; the English part is used. */
const labelOf = (text: string) => {
  const english = text.includes('/') ? text.slice(text.lastIndexOf('/') + 1) : text;
  return english.replace(/[.:]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
};

/**
 * The receipt's table rows, label → value. The invoice table has its labels on one row and the
 * values on the next (Invoice No. | Payment date | Settled Amount); those are paired by column.
 */
function rowsOf(html: string): Map<string, string> {
  const body = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const rows = [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) =>
    [...(m[1] ?? '').matchAll(/<t[dh][^>]*>([\s\S]*?)(?=<t[dh][\s>]|<\/tr>|$)/gi)].map((c) =>
      cellText(c[1] ?? '')
    )
  );
  const map = new Map<string, string>();
  rows.forEach((cells, i) => {
    const filled = cells.filter(Boolean);
    if (filled.length === 2) {
      const [label = '', value = ''] = filled;
      const key = labelOf(label);
      if (!map.has(key)) map.set(key, value);
    }
    // A header row of labels only, followed by its values (the invoice table).
    if (filled.length >= 3 && filled.every((c) => c.includes('/'))) {
      const values = (rows[i + 1] ?? []).filter(Boolean);
      filled.forEach((label, col) => {
        const value = values[col];
        if (value) map.set(labelOf(label), value);
      });
    }
  });
  return map;
}

/** "13-10-2026 13:33:02" (day-month-year, Addis Ababa time) → Date. */
function addisDate(text: string): Date | null {
  const m = /(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(text);
  if (!m) return null;
  const [, day, month, year, hour, minute, second] = m;
  const date = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour) - ADDIS_OFFSET_HOURS,
      Number(minute),
      Number(second ?? 0)
    )
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Telebirr's answer for an unknown transaction number. */
export const TELEBIRR_NOT_FOUND = /This request is not correct/i;

/**
 * Telebirr receipt page (transactioninfo.ethiotelecom.et/receipt/<number>), as checked against
 * real ones. Wallet to wallet: the credited party is the receiver (name + phone masked to first
 * and last 4 digits). Wallet to bank: the credited party is the bank; the real destination is
 * the "Bank account number" row (full number + holder name).
 */
export const telebirrParser: ReceiptParser = {
  parse(html) {
    const rows = rowsOf(html);
    const get = (label: string) => rows.get(label) ?? '';

    const reference = get('invoice no').toUpperCase();
    const date = addisDate(get('payment date'));
    const amount = /([\d,]+(?:\.\d+)?)\s*Birr/i.exec(get('settled amount'));
    const status = get('transaction status');
    const payerName = get('payer name');
    const payerAccount = get('payer telebirr no');
    const creditedName = get('credited party name');
    const creditedAccount = get('credited party account no');
    if (!/^[A-Z0-9]{10}$/.test(reference) || !date || !amount?.[1] || !status) return null;
    if (!payerName || !creditedName) return null;

    // "1000529213267 ABDURHAMAN ELIYAS MUHAMED" on transfers to a bank.
    const bankRow = /^(\d{8,16})\s+(.+)$/.exec(get('bank account number'));
    const toBank = Boolean(bankRow);
    const value = Number(amount[1].replace(/,/g, ''));
    if (!Number.isFinite(value)) return null;

    return {
      payerName,
      payerAccount,
      receiverName: toBank ? (bankRow?.[2] ?? '').trim() : creditedName,
      receiverAccount: toBank ? (bankRow?.[1] ?? '') : creditedAccount,
      amountEtb: Math.floor(value),
      currency: 'ETB',
      date,
      reference,
      status,
      transfer: toBank ? 'wallet_to_bank' : 'wallet',
      reason: get('payment reason'),
      destinationAccount: toBank ? (bankRow?.[1] ?? '') : '',
    } satisfies ParsedReceipt;
  },
};
