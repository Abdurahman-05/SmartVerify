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

/** GET /verify/failed — checks that did not verify in the period, newest first. */
export const getFailedChecks = (period: Period) =>
  api<FailedCheck[]>('/verify/failed', { query: { period } });

/**
 * POST /verify/read-reference — the Transaction ID and text of a receipt picture (base64), read
 * by Gemini on the server (OCR when Gemini is unavailable).
 */
export const readReference = (imageBase64: string) =>
  api<{ reference: string | null; text: string; source: 'gemini' | 'ocr' }>(
    '/verify/read-reference',
    {
      method: 'POST',
      body: { image: imageBase64 },
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

/** POST /verify/read-compare — DEVELOPMENT ONLY: Gemini vs Tesseract on the same picture. */
export const compareReading = (imageBase64: string) =>
  api<{ gemini: ReadResult; tesseract: ReadResult }>('/verify/read-compare', {
    method: 'POST',
    body: { image: imageBase64 },
    timeoutMs: 60_000,
  });
