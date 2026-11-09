import type { ListPeriod, Period } from '@/lib/period';

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

/**
 * GET /payments — paid bills in the period, newest first. With `since` (an ISO time) only the
 * payments recorded after it come back; payments never change once saved. With `day`
 * (YYYY-MM-DD) only that one day.
 */
export const getPayments = (period: ListPeriod, since?: string, day?: string) =>
  api<PaymentRecord[]>('/payments', { query: { period, since, date: day } });

/** Cash = paid with any cash (cash, cash + bank); bank = paid with any bank money. */
export type MoneyFilter = 'cash' | 'bank';

/** Totals for the Transactions screen, without loading every payment. */
export interface PaymentsSummary {
  count: number;
  salesEtb: number;
  cashCount: number;
  bankCount: number;
}

/** GET /payments — one page of a scrolling list: `before` is the oldest time already shown. */
export const getPaymentsPage = (
  period: ListPeriod,
  opts: { day?: string; money?: MoneyFilter; before?: string; limit: number }
) =>
  api<PaymentRecord[]>('/payments', {
    query: {
      period,
      date: opts.day,
      money: opts.money,
      before: opts.before,
      limit: String(opts.limit),
    },
  });

/** GET /payments/summary — count, sales and cash / bank counts for the period or day. */
export const getPaymentsSummary = (period: ListPeriod, day?: string) =>
  api<PaymentsSummary>('/payments/summary', { query: { period, date: day } });

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
