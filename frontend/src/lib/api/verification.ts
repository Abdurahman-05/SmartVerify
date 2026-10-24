import type { Period } from '@/lib/period';
import type { CbeCheck, FailedCheck } from '@/lib/mock/verification';

import { api } from './client';

/**
 * POST /verify/cbe — the server reads the CBE receipt behind the QR link and compares it with
 * the business's accounts and the amount. A check that does not verify is saved with the bill.
 * It fetches from the bank, so allow a bit longer.
 */
export const verifyCbe = (url: string, expectedAmountEtb: number, billId?: string) =>
  api<CbeCheck>('/verify/cbe', {
    method: 'POST',
    body: { url, expectedAmountEtb, ...(billId && { billId }) },
    timeoutMs: 25_000,
  });

/** One receipt that verified (GET /verify/history). */
export interface VerifiedCheck {
  id: string;
  billId: string | null;
  bankCode: string;
  reference: string;
  payerName: string | null;
  amountEtb: number;
  expectedAmountEtb: number;
  checkedBy: string;
  createdAt: string;
}

/** GET /verify/history — receipts verified in the period, newest first. */
export const getVerifiedChecks = (period: Period) =>
  api<VerifiedCheck[]>('/verify/history', { query: { period } });

/** GET /verify/failed — checks that did not verify in the period, newest first. */
export const getFailedChecks = (period: Period) =>
  api<FailedCheck[]>('/verify/failed', { query: { period } });

/**
 * POST /verify/read-reference — the Transaction ID and text of a receipt picture (base64), read
 * by Gemini on the server (OCR when Gemini is unavailable).
 */
export const readReference = (imageBase64: string, bank: 'CBE' | 'TEL' | 'DAS' | 'BOA' = 'CBE') =>
  api<{ reference: string | null; text: string; source: 'gemini' | 'ocr' }>(
    '/verify/read-reference',
    {
      method: 'POST',
      body: { image: imageBase64, bank },
      timeoutMs: 45_000,
    }
  );

/** One reader's result on the dev compare page. */
export interface ReadResult {
  ok: boolean;
  ms: number;
  reference?: string | null;
  amount?: number | null;
  date?: string | null;
  text?: string;
  error?: string;
}

/** POST /verify/read-compare — DEVELOPMENT ONLY: Gemini vs Tesseract vs Unlimited-OCR. */
export const compareReading = (imageBase64: string) =>
  api<{ gemini: ReadResult; tesseract: ReadResult; unlimited?: ReadResult }>(
    '/verify/read-compare',
    {
      method: 'POST',
      body: { image: imageBase64 },
      timeoutMs: 60_000,
    }
  );

/**
 * POST /verify/telebirr — the server reads the telebirr receipt for this transaction number
 * and compares it with the business's accounts and the amount (from the receipt's HTML).
 */
export const verifyTelebirr = (
  transactionNumber: string,
  expectedAmountEtb: number,
  billId?: string
) =>
  api<CbeCheck>('/verify/telebirr', {
    method: 'POST',
    body: { transactionNumber, expectedAmountEtb, ...(billId && { billId }) },
    timeoutMs: 25_000,
  });

/** POST /verify/dashen — the server reads the Dashen receipt for this FT Ref and compares it. */
export const verifyDashen = (reference: string, expectedAmountEtb: number, billId?: string) =>
  api<CbeCheck>('/verify/dashen', {
    method: 'POST',
    body: { reference, expectedAmountEtb, ...(billId && { billId }) },
    timeoutMs: 25_000,
  });

/** POST /verify/boa — the server reads the BOA receipt (FT reference + sender's last 5). */
export const verifyBoa = (receiptId: string, expectedAmountEtb: number, billId?: string) =>
  api<CbeCheck>('/verify/boa', {
    method: 'POST',
    body: { reference: receiptId, expectedAmountEtb, ...(billId && { billId }) },
    timeoutMs: 25_000,
  });
