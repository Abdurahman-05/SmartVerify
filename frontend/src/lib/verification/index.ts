import * as real from '@/lib/api/verification';
import * as mock from '@/lib/mock/verification';

import type { Period } from '@/lib/period';

export type { CbeCheck, CbeMismatch, CbeUnable, FailedCheck } from '@/lib/mock/verification';
export type { ReadResult } from '@/lib/api/verification';

/** EXPO_PUBLIC_USE_MOCK_VERIFICATION=true uses the offline mock; default is the real backend. */
export const USE_MOCK_VERIFICATION = process.env.EXPO_PUBLIC_USE_MOCK_VERIFICATION === 'true';

export const verifyCbe = USE_MOCK_VERIFICATION ? mock.verifyCbe : real.verifyCbe;
export const verifyTelebirr = USE_MOCK_VERIFICATION ? mock.verifyTelebirr : real.verifyTelebirr;
export const verifyDashen = USE_MOCK_VERIFICATION ? mock.verifyDashen : real.verifyDashen;
export const verifyBoa = USE_MOCK_VERIFICATION ? mock.verifyBoa : real.verifyBoa;
export const getFailedChecks = USE_MOCK_VERIFICATION ? mock.getFailedChecks : real.getFailedChecks;
export const readReference = USE_MOCK_VERIFICATION ? mock.readReference : real.readReference;
export const compareReading = USE_MOCK_VERIFICATION ? mock.compareReading : real.compareReading;

export const failedChecksKey = (period: Period) => ['failed-checks', period] as const;

/** A CBE receipt link from the receipt QR (the server checks it again strictly). */
export const isCbeReceiptLink = (text: string) =>
  /^https:\/\/(mbreciept\.cbe\.com\.et\/v2-[A-Za-z0-9]{10,64}$|apps\.cbe\.com\.et(:100)?\/\?id=FT[A-Z0-9]{10}\d{8}$)/.test(
    text.trim()
  );

/** The CBE receipt link: Transaction ID + the sender account's last 8 digits. */
export const cbeReceiptLink = (reference: string, senderLast8: string) =>
  `https://apps.cbe.com.et:100/?id=${reference}${senderLast8}`;

/** The telebirr receipt link for a transaction number (what the app checks for telebirr). */
export const telebirrReceiptLink = (transactionNumber: string) =>
  `https://transactioninfo.ethiotelecom.et/receipt/${transactionNumber}`;

/** The transaction number of a telebirr receipt link, or null. */
export const telebirrNumberOf = (text: string) =>
  /^https:\/\/transactioninfo\.ethiotelecom\.et\/receipt\/([A-Z0-9]{10})$/.exec(text.trim())?.[1] ??
  null;

/** The Dashen receipt link for an FT Ref (what the app checks for Dashen). */
export const dashenReceiptLink = (reference: string) =>
  `https://receipts.dashenbanksc.com/receipt/${reference}`;

/** The FT Ref of a Dashen receipt link, or null. */
export const dashenReferenceOf = (text: string) =>
  /^https:\/\/receipts\.dashenbanksc\.com\/receipt\/([A-Z0-9]{10,24})$/.exec(text.trim())?.[1] ??
  null;

/** The BOA receipt link: FT reference + the sender account's last 5 digits. */
export const boaReceiptLink = (reference: string, senderLast5: string) =>
  `https://cs.bankofabyssinia.com/slip/?trx=${reference}${senderLast5}`;

/** The receipt id (FT… + 5 digits) of a BOA receipt link, or null. */
export const boaReceiptIdOf = (text: string) =>
  /^https:\/\/cs\.bankofabyssinia\.com\/slip\/\?trx=(FT[A-Z0-9]{10}\d{5})$/.exec(
    text.trim()
  )?.[1] ?? null;

/** Dashen's receipt QR hides the FT Ref: 16 bytes XOR this fixed key (worked out from real QRs). */
const DASHEN_QR_KEY = 'a6ad5615fdcc45f1bc8ec322c3db1943';

/**
 * The FT Ref inside a Dashen Super App receipt QR ("superappreceipt_<32 hex>.<…>"), or null.
 * The server still fetches the real receipt, so a wrong decode only fails as "not found".
 */
export function dashenReferenceFromQr(text: string): string | null {
  const hex = /^superappreceipt_([0-9a-f]{32})\./i.exec(text.trim())?.[1]?.toLowerCase();
  if (!hex) return null;
  let reference = '';
  for (let i = 0; i < 32; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16) ^ parseInt(DASHEN_QR_KEY.slice(i, i + 2), 16);
    reference += String.fromCharCode(byte);
  }
  return /^[A-Z0-9]{16}$/.test(reference) && /\d/.test(reference) && /[A-Z]/.test(reference)
    ? reference
    : null;
}

/** CRC-16/CCITT-FALSE, the checksum at the end of a telebirr receipt QR (as in EMV QR codes). */
function crc16(text: string): string {
  let crc = 0xffff;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * The transaction number inside a telebirr receipt QR (Base64 of "…000A<10 chars as hex>6304<CRC>"),
 * or null when it is not one or its checksum is wrong.
 */
export function telebirrNumberFromQr(text: string): string | null {
  let data: string;
  try {
    data = atob(text.trim());
  } catch {
    return null;
  }
  const match = /000A([0-9A-Fa-f]{20})6304([0-9A-Fa-f]{4})$/.exec(data);
  if (!match?.[1] || !match[2] || crc16(data.slice(0, -4)) !== match[2].toUpperCase()) return null;
  let number = '';
  for (let i = 0; i < 20; i += 2)
    number += String.fromCharCode(parseInt(match[1].slice(i, i + 2), 16));
  return /^[A-Z0-9]{10}$/.test(number) ? number : null;
}

/**
 * The receipt link to check for a scanned receipt QR of this bank (CBE, telebirr, Dashen), or
 * null when the QR is not one of its receipts. No OCR needed.
 */
export function receiptLinkFromQr(bankCode: string, data: string): string | null {
  if (bankCode === 'CBE') return isCbeReceiptLink(data) ? data.trim() : null;
  if (bankCode === 'TEL') {
    const number = telebirrNumberFromQr(data) ?? telebirrNumberOf(data);
    return number ? telebirrReceiptLink(number) : null;
  }
  if (bankCode === 'DAS') {
    const reference = dashenReferenceFromQr(data) ?? dashenReferenceOf(data);
    return reference ? dashenReceiptLink(reference) : null;
  }
  return null;
}
