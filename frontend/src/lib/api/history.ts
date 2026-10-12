import type { Period } from '@/lib/period';

import { api, ApiError } from './client';

export type PayMethod = 'cash' | 'bank' | 'cash+bank';

/** One paid bill (GET /payments). Tips and change are not part of the sale. */
export interface PaymentRecord {
  id: string;
  billId: string;
  label: string;
  type: 'dine' | 'takeaway' | 'delivery';
  method: PayMethod;
  salesEtb: number;
  cashEtb: number;
  bankEtb: number;
  tipEtb: number;
  changeEtb: number;
  waiterName: string;
  recordedBy: string;
  createdAt: string;
}

export interface PaymentRecordDetail extends PaymentRecord {
  foodTotalEtb: number;
  packingFeeEtb: number;
  deliveryFeeEtb: number;
  items: { name: string; priceEtb: number; quantity: number }[];
}

export interface PaymentsReport {
  period: Period;
  totalEtb: number;
  count: number;
  cashEtb: number;
  bankEtb: number;
  tipsEtb: number;
  rows: { method: PayMethod; count: number; totalEtb: number; share: number }[];
}

/** GET /payments — paid bills in the period, newest first. */
export const getPayments = (period: Period) =>
  api<PaymentRecord[]>('/payments', { query: { period } });

/** GET /payments/:id — null when it does not exist (or is not yours). */
export async function getPayment(id: string): Promise<PaymentRecordDetail | null> {
  try {
    return await api<PaymentRecordDetail>(`/payments/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'NOT_FOUND') return null;
    throw error;
  }
}

/** GET /reports/payments — sales by payment method (tips not included). */
export const getPaymentsReport = (period: Period) =>
  api<PaymentsReport>('/reports/payments', { query: { period } });
