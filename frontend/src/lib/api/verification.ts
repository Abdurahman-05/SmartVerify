import type { CbeCheck } from '@/lib/mock/verification';

import { api } from './client';

/**
 * POST /verify/cbe — the server reads the CBE receipt behind the QR link and compares it with
 * the business's accounts and the amount. It fetches from the bank, so allow a bit longer.
 */
export const verifyCbe = (url: string, expectedAmountEtb: number) =>
  api<CbeCheck>('/verify/cbe', {
    method: 'POST',
    body: { url, expectedAmountEtb },
    timeoutMs: 25_000,
  });
