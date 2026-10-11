import type { Period } from '@/lib/period';

import { api } from './client';

/** GET /overview — owner/manager numbers for the period (tips are not sales). */
export interface Overview {
  period: Period;
  salesEtb: number;
  cashEtb: number;
  bankEtb: number;
  tipsEtb: number;
  paidBills: number;
  orders: number;
  openBills: number;
  openTables: number;
  deliveryFeeChanges: {
    count: number;
    latest: { billId: string; changedBy: string; usualFeeEtb: number; feeEtb: number }[];
  };
}

export const getOverview = (period: Period) => api<Overview>('/overview', { query: { period } });
