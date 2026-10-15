import type { ParsedReceipt, ReceiptParser } from './types.js';

/** Addis Ababa is UTC+3 all year (no daylight saving). */
const ADDIS_OFFSET_HOURS = 3;

// Labels as printed on the CBE PDF receipt (apps.cbe.com.et:100 links), checked against a real
// one. Mobile banking receipts (mbreciept links) come as JSON (parseDetail).
const ACCOUNT = String.raw`([0-9A-Z][0-9*Xx]{3,})`;
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
  reason: /Reason\s*\/\s*Type\s+of\s+service\s*:?\s*(\S+)/i,
  paymentType: /Payment\s+Type\s*:?\s*([A-Z0-9_]+)/,
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
 * An account number as printed: full digits, or masked like 2********1611 (the PDF receipt shows
 * only the first digit and the last 4). Masked numbers keep their stars.
 */
const accountOf = (v: string) => v.replace(/[^0-9*]/g, '');

/** CBE shows "Inter Bank Account To Account Paya…" as receiver for transfers to other banks. */
const INTER_BANK = /^inter\s*bank/i;

/** Which kind of transfer, and where the money really went for other-bank transfers. */
function transferOf(input: {
  paymentType: string;
  receiverName: string;
  reason: string;
  external?: string;
  isOtherBank?: boolean;
}): Pick<ParsedReceipt, 'transfer' | 'destinationAccount'> {
  const otherBank =
    input.isOtherBank === true ||
    /^BANK_TRANSFER$/i.test(input.paymentType) ||
    INTER_BANK.test(input.receiverName) ||
    Boolean(input.external);
  return otherBank
    ? { transfer: 'other_bank', destinationAccount: accountOf(input.external || input.reason) }
    : { transfer: 'cbe', destinationAccount: '' };
}

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

  // Same order as CBE's own receipt page uses for "Reason / Type of service".
  const details = Array.isArray(d['paymentDetails']) ? (d['paymentDetails'] as unknown[]) : [];
  const reason = str(d['description']) || str(d['notes']) || str(details[0]);
  const transfer = transferOf({
    paymentType: str(d['paymentType']) || str(d['platformTransactionType']),
    receiverName: fields.receiverName,
    reason,
    external: str(d['externalAccountNumber']),
    isOtherBank: d['isOtherBank'] === true,
  });

  return {
    ...transfer,
    reason,
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
    // The PDF receipt has no status line: CBE issues it only for transfers that went through.
    const [status = 'COMPLETED'] = groups(patterns.status.exec(text)) ?? [];
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

    const [reason = ''] = groups(patterns.reason.exec(text)) ?? [];
    const [paymentType = ''] = groups(patterns.paymentType.exec(text)) ?? [];
    const receipt: ParsedReceipt = {
      ...transferOf({ paymentType, receiverName: receiverName.trim(), reason }),
      reason,
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
