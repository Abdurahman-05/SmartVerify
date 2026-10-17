import type { ParsedReceipt, ReceiptParser } from './types.js';

/** Addis Ababa is UTC+3 all year (no daylight saving). */
const ADDIS_OFFSET_HOURS = 3;

/** BOA's answer for an unknown receipt id. */
export const BOA_NOT_FOUND = /Invalid reference number/i;

/** "26/08/26 14:36" (day/month/2-digit year, Addis Ababa time) → Date. */
function addisDate(text: string): Date | null {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(text);
  if (!m) return null;
  const [, day, month, year = '', hour, minute, second] = m;
  const fullYear = year.length === 2 ? 2000 + Number(year) : Number(year);
  const date = new Date(
    Date.UTC(
      fullYear,
      Number(month) - 1,
      Number(day),
      Number(hour) - ADDIS_OFFSET_HOURS,
      Number(minute),
      Number(second ?? 0)
    )
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/**
 * Bank of Abyssinia receipt JSON (cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=<FT
 * reference + sender account's last 5 digits>), as checked against a real one. The receiver is
 * "Receiver's Account" / "Receiver's Name" (the names BOA's own receipt page reads); transfers
 * to telebirr have neither, so they cannot match an account. There is no status field: BOA only
 * returns a receipt for a completed transfer.
 */
export const boaParser: ReceiptParser = {
  parse(json) {
    let body: unknown;
    try {
      body = (JSON.parse(json) as { body?: unknown[] }).body?.[0];
    } catch {
      return null;
    }
    if (!body || typeof body !== 'object') return null;
    const d = body as Record<string, unknown>;

    const reference = str(d['Transaction Reference']).toUpperCase();
    const date = addisDate(str(d['Transaction Date']));
    const value = Number(str(d['Transferred Amount']).replace(/,/g, ''));
    if (!/^FT[A-Z0-9]{10}$/.test(reference) || !date || !Number.isFinite(value) || value <= 0) {
      return null;
    }
    const receiverAccount = str(d["Receiver's Account"]).replace(/\s/g, '');
    const masked = receiverAccount.includes('*');

    return {
      payerName: str(d['Source Account Name']) || str(d["Payer's Name"]),
      payerAccount: str(d['Source Account']),
      receiverName: str(d["Receiver's Name"]),
      receiverAccount,
      amountEtb: Math.floor(value),
      currency: str(d['currency']).toUpperCase() || 'ETB',
      date,
      reference,
      status: 'COMPLETED',
      // Full number: must equal a saved account; masked: first/last digits must fit one.
      transfer: masked ? 'masked_account' : 'wallet_to_bank',
      reason: str(d['Transaction Type']),
      destinationAccount: masked ? '' : receiverAccount,
      destinationBank: masked ? 'any bank' : undefined,
    } satisfies ParsedReceipt;
  },
};
