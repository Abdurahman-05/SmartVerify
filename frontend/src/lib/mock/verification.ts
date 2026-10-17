import type { Period } from '@/lib/period';

import { mockDelay } from './mock';

export type CbeMismatch =
  'WRONG_RECEIVER' | 'WRONG_RECEIVER_NAME' | 'AMOUNT_TOO_LOW' | 'NOT_SUCCESS' | 'EXPIRED';
export type CbeUnable = 'TIMEOUT' | 'UNREACHABLE' | 'NOT_FOUND' | 'UNPARSEABLE';

/** The server's answer to a CBE receipt check (POST /verify/cbe). */
export type CbeCheck =
  | {
      status: 'verified';
      reference: string;
      amountEtb: number;
      extraEtb: number;
      payerName: string;
      receiverName: string;
      date: string;
    }
  | { status: 'not_matching'; reasons: CbeMismatch[]; reference: string; amountEtb: number }
  | { status: 'unable_to_verify'; reason: CbeUnable };

/** Offline stand-in: every receipt is paid exactly. */
export async function verifyCbe(
  url: string,
  expectedAmountEtb: number,
  _billId?: string
): Promise<CbeCheck> {
  await mockDelay(1500);
  return {
    status: 'verified',
    reference: `FT${url.length}MOCK0000`.slice(0, 12),
    amountEtb: expectedAmountEtb,
    extraEtb: 0,
    payerName: 'Mock Payer',
    receiverName: 'Mock Business',
    date: new Date().toISOString(),
  };
}

/** A receipt check that did not verify, kept for history (GET /verify/failed). */
export interface FailedCheck {
  id: string;
  billId: string | null;
  label: string | null;
  bankCode: string;
  status: 'not_matching' | 'unable_to_verify';
  reasons: (CbeMismatch | CbeUnable)[];
  reference: string | null;
  receiptAmountEtb: number | null;
  expectedAmountEtb: number;
  checkedBy: string;
  createdAt: string;
}

/** Offline: the mock never fails a check, so there is nothing to list. */
export async function getFailedChecks(_period: Period): Promise<FailedCheck[]> {
  await mockDelay(300);
  return [];
}

/** Offline stand-in for reading a picture: always "finds" the same Transaction ID. */
export async function readReference(
  _imageBase64: string,
  _bank: 'CBE' | 'TEL' | 'DAS' | 'BOA' = 'CBE'
): Promise<{ reference: string | null; text: string; source: 'gemini' | 'ocr' }> {
  await mockDelay(1200);
  return { reference: 'FT26286JZH4B', text: 'Transaction ID: FT26286JZH4B', source: 'gemini' };
}

/** Offline stand-in for the dev compare page. */
export async function compareReading(_imageBase64: string) {
  await mockDelay(1500);
  const text = 'Completed ETB2300.00 transfer\non 05/10/2026 FT26279V27Y0';
  return {
    gemini: {
      ok: true,
      ms: 1800,
      reference: 'FT26279V27Y0',
      amount: 2300,
      date: '05/10/2026',
      text,
    },
    tesseract: { ok: true, ms: 4200, reference: 'FT26279V27Y0', text },
  };
}

/** Offline stand-in for the telebirr check: paid exactly. */
export const verifyTelebirr = (number: string, expectedAmountEtb: number, billId?: string) =>
  verifyCbe(number, expectedAmountEtb, billId);

/** Offline stand-in for the Dashen check: paid exactly. */
export const verifyDashen = (reference: string, expectedAmountEtb: number, billId?: string) =>
  verifyCbe(reference, expectedAmountEtb, billId);

/** Offline stand-in for the BOA check: paid exactly. */
export const verifyBoa = (receiptId: string, expectedAmountEtb: number, billId?: string) =>
  verifyCbe(receiptId, expectedAmountEtb, billId);
