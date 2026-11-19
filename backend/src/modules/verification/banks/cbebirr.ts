import { awashBankCode } from './awash.js';
import type { ParsedReceipt, ReceiptParser } from './types.js';

/** Addis Ababa is UTC+3 all year (no daylight saving). */
const ADDIS_OFFSET_HOURS = 3;

/**
 * Labels as printed on the CBE Birr "VAT Invoice / Customer Receipt" PDF (cbepay1.cbe.com.et/
 * aureceipt), checked against a real one. The text comes out of the PDF as, after whitespace is
 * collapsed:
 *
 *   ... Debit Account 09XXXXXXXX - <payer name> Credit Account 1000****3267 - CBE
 *   Receiver Name <name> Order ID FT263238WRLV Transaction Status Completed Reference :
 *   Transaction Details Receipt Number Transaction Date Amount DKJ21VTI2J2 2026-11-19 10:14 10.00 ...
 *
 * Receipt Number = the CBE Birr ID (DKJ...). Order ID = the CBE core FT reference, the same one
 * the normal CBE receipt shows (used so one payment is never accepted twice). The credit account
 * is masked by the bank (first 4 and last 4 digits); the receiver name is printed in full. The
 * receipt has no phone number of the receiver, and we never keep the payer's.
 */
export const CBEBIRR_PATTERNS = {
  payer: /Debit\s+Account\s+[\d*Xx]+\s*-\s*(.+?)\s+Credit\s+Account/i,
  /** account (digits and stars) - bank name, e.g. "1000****3267 - CBE" */
  credit: /Credit\s+Account\s+([\d*Xx]+)\s*-\s*(.+?)\s+Receiver\s+Name/i,
  receiver: /Receiver\s+Name\s+(.+?)\s+Order\s+ID/i,
  orderId: /Order\s+ID\s+(FT[A-Z0-9]{10})\b/i,
  status: /Transaction\s+Status\s+([A-Za-z]+)/i,
  /** The row under "Receipt Number Transaction Date Amount": DKJ21VTI2J2 2026-11-19 10:14 10.00 */
  row: /Receipt\s+Number\s+Transaction\s+Date\s+Amount\s+([A-Z0-9]{8,16})\s+(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})\s+([\d,]+(?:\.\d{1,2})?)/i,
};

/** The receipt number as CBE Birr prints it (DKJ21VTI2J2). */
const RECEIPT_NUMBER = /^[A-Z0-9]{8,16}$/;

export const cbeBirrParser: ReceiptParser = {
  /** `content` is the text extracted from the PDF. null when any required field is missing. */
  parse(content) {
    const text = content.replace(/\s+/g, ' ');
    const p = CBEBIRR_PATTERNS;
    const row = p.row.exec(text);
    const receiver = p.receiver.exec(text)?.[1]?.trim();
    const orderId = p.orderId.exec(text)?.[1];
    const status = p.status.exec(text)?.[1];
    if (!row || !receiver || !orderId || !status) return null;

    const [, number, year, month, day, hour, minute, amount] = row;
    if (!number || !RECEIPT_NUMBER.test(number) || !amount) return null;
    const value = Number(amount.replace(/,/g, ''));
    const date = new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour) - ADDIS_OFFSET_HOURS,
        Number(minute)
      )
    );
    if (!Number.isFinite(value) || value <= 0 || Number.isNaN(date.getTime())) return null;

    // The account is optional: without it the receiver is matched by name only (the caller says
    // so). A credit line that is there but unreadable is not guessed at.
    const credit = p.credit.exec(text);
    const account = credit?.[1] ?? '';
    const bankName = credit?.[2]?.trim() ?? 'CBE';
    if (/credit\s+account/i.test(text) && !credit) return null;

    return {
      payerName: p.payer.exec(text)?.[1]?.trim() ?? '',
      // Never keep the payer's phone number.
      payerAccount: '',
      receiverName: receiver,
      receiverAccount: account,
      amountEtb: Math.floor(value),
      currency: 'ETB',
      date,
      reference: number.toUpperCase(),
      altReference: orderId.toUpperCase(),
      status,
      transfer: 'cbebirr',
      reason: '',
      destinationAccount: '',
      destinationBank: awashBankCode(bankName),
    } satisfies ParsedReceipt;
  },
};
