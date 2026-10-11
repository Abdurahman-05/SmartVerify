import * as real from '@/lib/api/overview';
import type { Overview } from '@/lib/api/overview';
import { openBills, useBills } from '@/features/bills/store';
import { usePayments } from '@/features/payments/store';
import { USE_MOCK_BILLS } from '@/lib/bills';
import { periodRange, type Period } from '@/lib/period';

export type { Overview } from '@/lib/api/overview';

// The overview follows the bills switch (EXPO_PUBLIC_USE_MOCK_BILLS).
export const getOverview = USE_MOCK_BILLS
  ? async (period: Period): Promise<Overview> => {
      const { from } = periodRange(period);
      const payments = usePayments.getState().payments.filter((p) => new Date(p.createdAt) >= from);
      const open = openBills(useBills.getState().bills);
      const tipsEtb = payments.reduce((s, p) => s + p.tip, 0);
      const cashEtb = payments.reduce(
        (s, p) => s + (p.method === 'cash' ? p.cash - p.tip : p.cash),
        0
      );
      const bankEtb = payments.reduce((s, p) => s + (p.method === 'cash' ? 0 : p.bank - p.tip), 0);
      return {
        period,
        salesEtb: cashEtb + bankEtb,
        cashEtb,
        bankEtb,
        tipsEtb,
        paidBills: payments.length,
        orders: payments.length + open.length,
        openBills: open.length,
        openTables: open.filter((b) => b.type === 'dine').length,
        deliveryFeeChanges: { count: 0, latest: [] },
      };
    }
  : real.getOverview;

export const overviewKey = (period: Period) => ['overview', period] as const;
