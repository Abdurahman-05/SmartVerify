import { api } from './client';

export type PayRequest =
  | { method: 'cash'; cashEtb: number; extraChoice: 'tip' | 'giveback' }
  | { method: 'bank'; bankReceivedEtb: number; reference?: string }
  | { method: 'cash+bank'; cashEtb: number; bankReceivedEtb: number; reference?: string };

/** The server's verdict for one payment step (POST /bills/:id/payments). */
export interface PayResult {
  status: 'paid' | 'over' | 'short';
  billId: string;
  method: 'cash' | 'bank' | 'cash+bank';
  totalEtb: number;
  cashEtb: number;
  /** All bank money received for the bill so far. */
  bankReceivedEtb: number;
  expectedBankEtb: number;
  remainingEtb: number;
  tipEtb: number;
  changeEtb: number;
}

/**
 * POST /bills/:id/payments — cash only, or one bank scan. The server adds up the scans and
 * decides paid / over (tip) / short. Send the same key when retrying the same step.
 */
export const payBill = (billId: string, body: PayRequest, idempotencyKey: string) =>
  api<PayResult>(`/bills/${encodeURIComponent(billId)}/payments`, {
    method: 'POST',
    body,
    idempotencyKey,
  });
