import * as real from '@/lib/api/history';
import type {
  PaymentRecord,
  PaymentRecordDetail,
  PaymentsReport,
  PayMethod,
} from '@/lib/api/history';
import { useBills } from '@/features/bills/store';
import { usePayments } from '@/features/payments/store';
import { USE_MOCK_BILLS } from '@/lib/bills';
import { periodRange, type Period } from '@/lib/period';

export type {
  PaymentRecord,
  PaymentRecordDetail,
  PaymentsReport,
  PayMethod,
} from '@/lib/api/history';

export const payMethods: PayMethod[] = ['cash', 'bank', 'cash+bank'];

// History follows the bills switch (EXPO_PUBLIC_USE_MOCK_BILLS): payments come from bills.

/** Offline: payments taken in the app, shaped like the server's. */
function mockPayments(period: Period): PaymentRecordDetail[] {
  const { from } = periodRange(period);
  const bills = useBills.getState().bills;
  return usePayments
    .getState()
    .payments.filter((p) => new Date(p.createdAt) >= from)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .flatMap((p) => {
      const bill = bills.find((b) => b.id === p.billId);
      if (!bill) return [];
      const tipFromCash = p.method === 'cash' ? p.tip : 0;
      const change = p.method === 'cash' ? Math.max(p.cash - bill.total - p.tip, 0) : 0;
      return [
        {
          id: p.id,
          billId: p.billId,
          label: bill.type === 'dine' ? `Table ${bill.tableNo ?? ''}` : `#${bill.orderNo}`,
          type: bill.type,
          method: p.method,
          salesEtb: bill.total,
          cashEtb: p.cash - change - tipFromCash,
          bankEtb: p.bank - (p.tip - tipFromCash),
          tipEtb: p.tip,
          changeEtb: change,
          waiterName: p.waiterName,
          recordedBy: p.waiterName,
          createdAt: p.createdAt,
          foodTotalEtb: bill.foodTotal,
          packingFeeEtb: bill.packingFee,
          deliveryFeeEtb: bill.deliveryFee,
          items: bill.items.map(({ name, priceEtb, quantity }) => ({ name, priceEtb, quantity })),
        },
      ];
    });
}

export const getPayments: (period: Period) => Promise<PaymentRecord[]> = USE_MOCK_BILLS
  ? async (period) => mockPayments(period)
  : real.getPayments;

export const getPayment: (id: string) => Promise<PaymentRecordDetail | null> = USE_MOCK_BILLS
  ? async (id) => mockPayments('30d').find((p) => p.id === id) ?? null
  : real.getPayment;

export const getPaymentsReport: (period: Period) => Promise<PaymentsReport> = USE_MOCK_BILLS
  ? async (period) => {
      const payments = mockPayments(period);
      const cashEtb = payments.reduce((s, p) => s + p.cashEtb, 0);
      const bankEtb = payments.reduce((s, p) => s + p.bankEtb, 0);
      const totalEtb = cashEtb + bankEtb;
      return {
        period,
        totalEtb,
        count: payments.length,
        cashEtb,
        bankEtb,
        tipsEtb: payments.reduce((s, p) => s + p.tipEtb, 0),
        rows: payMethods.map((method) => {
          const own = payments.filter((p) => p.method === method);
          const total = own.reduce((s, p) => s + p.salesEtb, 0);
          return {
            method,
            count: own.length,
            totalEtb: total,
            share: totalEtb ? Math.round((total / totalEtb) * 100) : 0,
          };
        }),
      };
    }
  : real.getPaymentsReport;

export const paymentsKey = (period: Period) => ['payments', period] as const;
export const paymentKey = (id: string) => ['payment', id] as const;
export const reportKey = (period: Period) => ['payments-report', period] as const;
