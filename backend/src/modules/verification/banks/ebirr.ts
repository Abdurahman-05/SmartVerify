import type { ParsedReceipt, ReceiptParser } from './types.js';

/** What the receipt site answers (HTTP 200) for a token it does not know. */
export const EBIRR_NOT_FOUND = /Not Found Page/i;

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#43;': '+',
};

/** The visible text cells of the page, in order: ["DATE:", "2026-10-20 …", "RECEIPT NO:", …]. */
function cellsOf(html: string): string[] {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, '\u0001')
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39|#43);/g, (e) => ENTITIES[e] ?? ' ')
    .split('\u0001')
    .map((cell) => cell.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** The cell after the one that ends with this label ("የተቀባይ ስም/Receiver name" → its value). */
function after(cells: string[], label: RegExp): string {
  const i = cells.findIndex((cell) => label.test(cell));
  return i >= 0 ? (cells[i + 1] ?? '') : '';
}

/** "2026-10-20 15:20:12 +0300 EAT" → Date (the offset is printed; Addis Ababa is +0300). */
function receiptDate(text: string): Date | null {
  const m = /(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})(?:\s*([+-])(\d{2})(\d{2}))?/.exec(
    text
  );
  if (!m) return null;
  const sign = m[7] === '-' ? -1 : 1;
  const offsetMinutes = m[8] ? sign * (Number(m[8]) * 60 + Number(m[9])) : 180;
  const date = new Date(
    Date.UTC(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5]) - offsetMinutes,
      Number(m[6])
    )
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * eBirr receipt page (receipt.ebirr.com/<institution>/<token>), as checked against real ones.
 * Two kinds are read from "Payment Reason":
 * - to a bank account (instant payment network): the account is printed with its middle hidden
 *   (231XXXX31) and the receipt carries no holder name;
 * - to a wallet: "Transfer of ETB10 to <Name>(<phone>) via <institution>".
 * The page exists only for known tokens, and shows "Completed" for finished payments.
 */
export const ebirrParser: ReceiptParser = {
  parse(html) {
    const cells = cellsOf(html);
    const reference = after(cells, /^RECEIPT NO:?$/i).replace(/\D/g, '');
    const date = receiptDate(after(cells, /^DATE:?$/i));
    const status = after(cells, /transaction status$/i);
    const reason = after(cells, /Payment Reason$/i);
    const payerName = after(cells, /Sender Name$/i);
    const payerAccount = after(cells, /Sender Ebirr no\.?$/i).replace(/\D/g, '');
    // AMOUNT: / "ETB" / "10"
    const amountCell = cells[cells.findIndex((c) => /^AMOUNT:?$/i.test(c)) + 2] ?? '';
    const amount = Number(amountCell.replace(/,/g, ''));
    if (!/^\d{6,20}$/.test(reference) || !date || !status || !reason || !payerName) return null;
    if (!Number.isFinite(amount) || amount <= 0) return null;

    const base = {
      payerName,
      payerAccount,
      amountEtb: Math.floor(amount),
      currency: 'ETB',
      date,
      reference,
      status,
      reason,
    };

    // "Bank Transfer of ETB10 from 2519… To Bank Account 231XXXX31"
    const bank = /\bTo Bank Account\s+([0-9Xx*]{6,20})\b/i.exec(reason);
    if (bank?.[1] && /^\d+[Xx*]+\d+$/.test(bank[1])) {
      return {
        ...base,
        receiverName: '',
        receiverAccount: bank[1].replace(/[Xx]/g, '*'),
        transfer: 'ebirr_bank',
        destinationAccount: bank[1].replace(/[Xx]/g, '*'),
      } satisfies ParsedReceipt;
    }

    // "Transfer of ETB10 to Name Surname(251935758099) via Cooperative Bank of Oromia"
    const wallet = /\bto\s+(.+?)\s*\((\d{9,12})\)\s*via\b/i.exec(reason);
    if (wallet?.[1] && wallet[2]) {
      return {
        ...base,
        receiverName: wallet[1].trim(),
        receiverAccount: wallet[2],
        transfer: 'ebirr_wallet',
        destinationAccount: '',
      } satisfies ParsedReceipt;
    }
    return null;
  },
};
