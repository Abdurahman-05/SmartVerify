import * as real from '@/lib/api/verification';
import * as mock from '@/lib/mock/verification';

import type { Period } from '@/lib/period';

export type { CbeCheck, CbeMismatch, CbeUnable, FailedCheck } from '@/lib/mock/verification';

/** EXPO_PUBLIC_USE_MOCK_VERIFICATION=true uses the offline mock; default is the real backend. */
export const USE_MOCK_VERIFICATION = process.env.EXPO_PUBLIC_USE_MOCK_VERIFICATION === 'true';

export const verifyCbe = USE_MOCK_VERIFICATION ? mock.verifyCbe : real.verifyCbe;
export const getFailedChecks = USE_MOCK_VERIFICATION ? mock.getFailedChecks : real.getFailedChecks;

export const failedChecksKey = (period: Period) => ['failed-checks', period] as const;

/** A CBE receipt link from the receipt QR (the server checks it again strictly). */
export const isCbeReceiptLink = (text: string) =>
  /^https:\/\/(mbreciept\.cbe\.com\.et\/v2-[A-Za-z0-9]{10,64}$|apps\.cbe\.com\.et(:100)?\/\?id=FT[A-Z0-9]{10}\d{8}$)/.test(
    text.trim()
  );
