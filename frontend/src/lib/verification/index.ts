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
