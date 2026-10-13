import type { ParsedReceipt, ReceiptParser } from './types.js';

/** Addis Ababa is UTC+3 all year (no daylight saving). */
const ADDIS_OFFSET_HOURS = 3;

// Labels as printed on CBE PDF/HTML transfer receipts (apps.cbe.com.et links). Not yet checked
// against a real receipt of that kind; mobile banking receipts come as JSON (parseDetail).
const ACCOUNT = String.raw`([0-9][0-9*Xx]{3,})`;
const patterns = {
  payer: new RegExp(String.raw`Payer\s*:?\s*(.+?)\s+Account\s*(?:No\.?)?\s*:?\s*${ACCOUNT}`, 'i'),
  receiver: new RegExp(
    String.raw`Receiver\s*:?\s*(.+?)\s+Account\s*(?:No\.?)?\s*:?\s*${ACCOUNT}`,
    'i'
  ),
  date: /Payment\s+Date\s*(?:&|and)\s*Time\s*:?\s*(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i,
  reference: /Reference\s+No\.?\s*(?:\(VAT\s+Invoice\s+No\))?\s*:?\s*(FT[A-Z0-9]{10})/i,
  amount: /Transferred\s+Amount\s*:?\s*([\d,]+(?:\.\d{1,2})?)\s*([A-Z]{3})/i,
  status: /Status\s*:?\s*([A-Za-z]+)/i,
};

/** "10/12/2026, 2:35:00 PM" (month/day/year, Addis Ababa time) → Date. */
function addisDate(m: RegExpExecArray): Date | null {
  const [, month, day, year, hour, minute, second, ampm] = m;
  let h = Number(hour);
  if (ampm) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (ampm.toUpperCase() === 'PM' ? 12 : 0);
  }
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

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/**
 * Mobile banking receipt JSON (mb.cbe.com.et transaction-detail), as in
 * tests/fixtures/cbe-detail.json. Accounts arrive masked; the last 4 digits are kept.
 */
function parseDetail(json: string): ParsedReceipt | null {
  let d: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return null;
    d = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  const dateTimes = Array.isArray(d['dateTimes']) ? (d['dateTimes'] as unknown[]) : [];
  const fields = {
    reference: str(d['id']),
    payerName: str(d['debitAccountHolder']),
    payerAccount: str(d['debitAccountNo']),
    receiverName: str(d['creditAccountHolder']),
    receiverAccount: str(d['creditAccountNo']),
    amount: str(d['amountCredited']),
    currency: str(d['creditCurrency']),
    date: str(dateTimes[0]),
    status: str(d['statusDesc']) || str(d['status']),
  };
  if (Object.values(fields).some((v) => !v) || !/^FT[A-Z0-9]{10}$/i.test(fields.reference)) {
    return null;
  }
  const value = Number(fields.amount.replace(/,/g, ''));
  const date = new Date(fields.date);
  if (!Number.isFinite(value) || Number.isNaN(date.getTime())) return null;

  return {
    payerName: fields.payerName,
    payerAccount: fields.payerAccount,
    receiverName: fields.receiverName,
    receiverAccount: fields.receiverAccount,
    amountEtb: Math.floor(value),
    currency: fields.currency.toUpperCase(),
    date,
    reference: fields.reference.toUpperCase(),
    status: fields.status,
  };
}

/** Captured groups of a match, '' where a group did not match. */
const groups = (m: RegExpExecArray | null) => (m ? m.slice(1).map((g) => g ?? '') : null);

export const cbeParser: ReceiptParser = {
  parse(content) {
    if (content.trimStart().startsWith('{')) return parseDetail(content);
    const text = content.replace(/\s+/g, ' ');
    const dateMatch = patterns.date.exec(text);
    const [payerName, payerAccount] = groups(patterns.payer.exec(text)) ?? [];
    const [receiverName, receiverAccount] = groups(patterns.receiver.exec(text)) ?? [];
    const [reference] = groups(patterns.reference.exec(text)) ?? [];
    const [amount, currency] = groups(patterns.amount.exec(text)) ?? [];
    const [status] = groups(patterns.status.exec(text)) ?? [];
    if (
      !dateMatch ||
      !payerName ||
      !payerAccount ||
      !receiverName ||
      !receiverAccount ||
      !reference ||
      !amount ||
      !currency ||
      !status
    ) {
      return null;
    }

    const date = addisDate(dateMatch);
    const value = Number(amount.replace(/,/g, ''));
    if (!date || !Number.isFinite(value)) return null;

    const receipt: ParsedReceipt = {
      payerName: payerName.trim(),
      payerAccount,
      receiverName: receiverName.trim(),
      receiverAccount,
      amountEtb: Math.floor(value),
      currency: currency.toUpperCase(),
      date,
      reference: reference.toUpperCase(),
      status,
    };
    return receipt;
  },
};
