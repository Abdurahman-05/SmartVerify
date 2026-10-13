import { mockDelay } from './mock';

export type CbeMismatch = 'WRONG_RECEIVER' | 'AMOUNT_TOO_LOW' | 'NOT_SUCCESS' | 'EXPIRED';
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
  | { status: 'not_matching'; reasons: CbeMismatch[] }
  | { status: 'unable_to_verify'; reason: CbeUnable };

/** Offline stand-in: every receipt is paid exactly. */
export async function verifyCbe(url: string, expectedAmountEtb: number): Promise<CbeCheck> {
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
