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
