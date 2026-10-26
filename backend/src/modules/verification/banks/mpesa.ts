import type { ParsedReceipt, ReceiptParser } from './types.js';

/** Addis Ababa is UTC+3 all year (no daylight saving). */
const ADDIS_OFFSET_HOURS = 3;

/** What the text step returns when M-PESA has no receipt for the number (responseCode not 0). */
export const MPESA_NOT_FOUND = 'M-PESA: receipt number does not exist';

const lineAfter = (text: string, label: RegExp) => label.exec(text)?.[1]?.trim() ?? '';

/**
 * M-PESA receipt (its PDF text), as checked against a real "Send To Bank" receipt. The money went
 * to a bank account: "BANK ACCOUNT NUMBER 231210431 - HOLDER NAME" and "RECEIVER BANK NAME …".
 * The receipt page exists only for completed transactions, so a readable receipt counts as
 * success. Other kinds (to an M-PESA wallet, merchant payments) are not read yet: null.
 */
export const mpesaParser: ReceiptParser = {
  parse(text) {
    const reference = /(?<!BANK )TRANSACTION ID\s+([A-Z0-9]{10})\b/.exec(text)?.[1];
    // "<receipt no> 2026-10-20 15:31:11 10.00": payment date (Addis time) and settled amount.
    const detail =
      /\b[A-Z0-9]{8,}\s+(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\s+([\d,]+(?:\.\d+)?)/.exec(
        text
      );
    const bank = /BANK ACCOUNT NUMBER\s+(\d{6,16})\s*-\s*([^\t\r\n]+)/.exec(text);
    if (!reference || !detail || !bank?.[1] || !bank[2]) return null;

    const [, year, month, day, hour, minute, second, settled] = detail;
    const date = new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour) - ADDIS_OFFSET_HOURS,
        Number(minute),
        Number(second)
      )
    );
    const amount = Number((settled ?? '').replace(/,/g, ''));
    if (Number.isNaN(date.getTime()) || !Number.isFinite(amount)) return null;

    return {
      payerName: lineAfter(text, /SENDER NAME\s+([^\r\n]+)/),
      payerAccount: lineAfter(text, /SENDER PHONE NUMBER\s+(\d{9,12})/),
      receiverName: bank[2].trim(),
      receiverAccount: bank[1],
      amountEtb: Math.floor(amount),
      currency: 'ETB',
      date,
      reference,
      status: 'Success',
      transfer: 'wallet_to_bank',
      reason: lineAfter(text, /PAYMENT REASON\s+([^\r\n]+)/),
      destinationAccount: bank[1],
      destinationBank: lineAfter(text, /RECEIVER BANK NAME\s+([^\t\r\n]+)/),
    } satisfies ParsedReceipt;
  },
};
