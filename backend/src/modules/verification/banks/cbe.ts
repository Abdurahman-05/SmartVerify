import type { ParsedReceipt, ReceiptParser } from './types.js';

/** Addis Ababa is UTC+3 all year (no daylight saving). */
const ADDIS_OFFSET_HOURS = 3;

// Labels as printed on CBE transfer receipts. No real sample is in tests/fixtures yet:
// check these against a real receipt and adjust.
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

/** Captured groups of a match, '' where a group did not match. */
const groups = (m: RegExpExecArray | null) => (m ? m.slice(1).map((g) => g ?? '') : null);

export const cbeParser: ReceiptParser = {
  parse(content) {
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
