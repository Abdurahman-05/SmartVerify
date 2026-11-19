import * as real from '@/lib/api/verification';
import * as mock from '@/lib/mock/verification';

import type { CbeCheck } from '@/lib/mock/verification';
import type { ListPeriod, Period } from '@/lib/period';

export type { CbeCheck, CbeMismatch, CbeUnable, FailedCheck } from '@/lib/mock/verification';
export type { ReadResult, VerifiedCheck } from '@/lib/api/verification';

/** EXPO_PUBLIC_USE_MOCK_VERIFICATION=true uses the offline mock; default is the real backend. */
export const USE_MOCK_VERIFICATION = process.env.EXPO_PUBLIC_USE_MOCK_VERIFICATION === 'true';

export const verifyCbe = USE_MOCK_VERIFICATION ? mock.verifyCbe : real.verifyCbe;
export const verifyTelebirr = USE_MOCK_VERIFICATION ? mock.verifyTelebirr : real.verifyTelebirr;
export const verifyMpesa = USE_MOCK_VERIFICATION ? mock.verifyMpesa : real.verifyMpesa;
export const verifyEbirr = USE_MOCK_VERIFICATION ? mock.verifyEbirr : real.verifyEbirr;
export const verifyDashen = USE_MOCK_VERIFICATION ? mock.verifyDashen : real.verifyDashen;
export const verifyBoa = USE_MOCK_VERIFICATION ? mock.verifyBoa : real.verifyBoa;
// The offline mock has no Awash check: it answers like its other banks (paid exactly).
export const verifyAwash = USE_MOCK_VERIFICATION ? mock.verifyCbe : real.verifyAwash;
// The offline mock has no CBE Birr check either: it answers like its other banks.
export const verifyCbeBirr = USE_MOCK_VERIFICATION ? mock.verifyCbe : real.verifyCbeBirr;
export const getFailedChecks: typeof real.getFailedChecks = USE_MOCK_VERIFICATION
  ? (period) => mock.getFailedChecks(period === 'all' ? '30d' : period)
  : real.getFailedChecks;
// The offline mock does not know Awash pictures: it answers as for CBE.
export const readReference: typeof real.readReference = USE_MOCK_VERIFICATION
  ? (image, bank) => mock.readReference(image, bank === 'AWA' ? 'CBE' : bank)
  : real.readReference;
export const compareReading = USE_MOCK_VERIFICATION ? mock.compareReading : real.compareReading;

export const failedChecksKey = (period: ListPeriod, day?: string) =>
  ['failed-checks', day ?? period] as const;

// The offline mock keeps no history of verified receipts.
export const getVerifiedChecks: typeof real.getVerifiedChecks = USE_MOCK_VERIFICATION
  ? async () => []
  : real.getVerifiedChecks;
export const verifiedChecksKey = (period: Period) => ['verified-checks', period] as const;

export type { VerifyTips } from '@/lib/api/verification';
export const keepTip = USE_MOCK_VERIFICATION ? mock.keepTip : real.keepTip;
export const getVerifyTips: typeof real.getVerifyTips = USE_MOCK_VERIFICATION
  ? mock.getVerifyTips
  : real.getVerifyTips;
export const verifyTipsKey = (period: Period) => ['verify-tips', period] as const;

/**
 * Checks a scanned receipt with the server, the same way for normal Verify and restaurant bills:
 * a CBE link, a telebirr number, a Dashen reference or a BOA receipt id. Anything else cannot be
 * checked (never counted as paid). The server saves every result and refuses a reused receipt.
 */
export async function checkReceipt(
  qrData: string,
  expectedAmountEtb: number,
  billId?: string
): Promise<CbeCheck> {
  const telebirr = telebirrNumberOf(qrData);
  if (telebirr) return verifyTelebirr(telebirr, expectedAmountEtb, billId);
  const mpesa = mpesaNumberOf(qrData);
  if (mpesa) return verifyMpesa(mpesa, expectedAmountEtb, billId);
  const ebirr = ebirrPathOf(qrData);
  if (ebirr) return verifyEbirr(ebirr, expectedAmountEtb, billId);
  const dashen = dashenReferenceOf(qrData);
  if (dashen) return verifyDashen(dashen, expectedAmountEtb, billId);
  const boa = boaReceiptIdOf(qrData);
  if (boa) return verifyBoa(boa, expectedAmountEtb, billId);
  const cbeBirr = cbeBirrLinkOf(qrData);
  if (cbeBirr) return verifyCbeBirr(cbeBirr, expectedAmountEtb, billId);
  const awash = awashLinkOf(qrData);
  if (awash && awash === qrData.trim()) return verifyAwash(awash, expectedAmountEtb, billId);
  if (isCbeReceiptLink(qrData)) return verifyCbe(qrData, expectedAmountEtb, billId);
  return { status: 'unable_to_verify', reason: 'UNPARSEABLE' };
}

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

/** The M-PESA receipt link for a transaction number (what the app checks for M-PESA). */
export const mpesaReceiptLink = (transactionNumber: string) =>
  `https://m-pesabusiness.safaricom.et/receipt/${transactionNumber}`;

/** The transaction number of an M-PESA receipt link, or null. */
export const mpesaNumberOf = (text: string) =>
  /^https:\/\/m-pesabusiness\.safaricom\.et\/receipt\/([A-Z0-9]{10})$/.exec(text.trim())?.[1] ??
  null;

/** The eBirr receipt link for its path "<institution>/<token>" (the token is case-sensitive). */
export const ebirrReceiptLink = (path: string) => `https://receipt.ebirr.com/${path}`;

/** The "<institution>/<token>" path of an eBirr receipt link, or null. */
export const ebirrPathOf = (text: string) =>
  /^https:\/\/receipt\.ebirr\.com\/([a-z0-9]{2,30}\/[A-Za-z0-9_-]{16,64})$/.exec(
    text.trim()
  )?.[1] ?? null;

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

/**
 * The Awash receipt link (https://awashpay.awashbank.com:8225/-2KK18G2CLN-6HVCHX) found in a
 * pasted SMS or link, or null. The server checks it again strictly before fetching.
 */
export function awashLinkOf(text: string): string | null {
  const token =
    /https:\/\/awashpay\.awashbank\.com:8225\/(-[A-Z0-9]{8,12}-[A-Z0-9]{4,8})(?![A-Z0-9-])/i.exec(
      text
    )?.[1];
  return token ? `https://awashpay.awashbank.com:8225/${token.toUpperCase()}` : null;
}

/**
 * The CBE Birr receipt link (https://cbepay1.cbe.com.et/aureceipt?TID=DKJ…&PH=…) found in a
 * pasted SMS or a scanned QR, or null. The server checks it again strictly before fetching.
 */
export function cbeBirrLinkOf(text: string): string | null {
  const m =
    /https:\/\/cbepay1\.cbe\.com\.et\/aureceipt\?TID=([A-Z0-9]{8,16})&PH=(\d{9,15})(?![A-Z0-9])/i.exec(
      text
    );
  return m ? `https://cbepay1.cbe.com.et/aureceipt?TID=${m[1]?.toUpperCase()}&PH=${m[2]}` : null;
}

/** A phone as CBE Birr's link wants it: 2519xxxxxxxx (digits only), or null when not a phone. */
export function cbeBirrPhoneOf(text: string): string | null {
  const d = text.replace(/\D/g, '');
  const intl = /^0[79]\d{8}$/.test(d) ? `251${d.slice(1)}` : d;
  return /^251[79]\d{8}$/.test(intl) ? intl : null;
}

/** The CBE Birr receipt link from the typed Transaction ID and phone. */
export const cbeBirrReceiptLink = (tid: string, phone: string) =>
  `https://cbepay1.cbe.com.et/aureceipt?TID=${tid}&PH=${phone}`;

/** TID and PH from a full CBE Birr link (pasted SMS or QR text), or null. */
export function cbeBirrPartsOf(text: string): { tid: string; phone: string } | null {
  const link = cbeBirrLinkOf(text);
  const m = link ? /TID=([A-Z0-9]+)&PH=(\d+)/.exec(link) : null;
  return m?.[1] && m[2] ? { tid: m[1], phone: m[2] } : null;
}

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
  if (bankCode === 'CBB') return cbeBirrLinkOf(data);
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
