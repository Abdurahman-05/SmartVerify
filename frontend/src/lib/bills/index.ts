import * as real from '@/lib/api/bills';
import { openBills } from '@/features/bills/store';
import * as mock from '@/lib/mock/bills';
import { useSession } from '@/store/session';

/** EXPO_PUBLIC_USE_MOCK_BILLS=true uses the offline mock (src/lib/mock/bills.ts); default is the real backend. */
export const USE_MOCK_BILLS = process.env.EXPO_PUBLIC_USE_MOCK_BILLS === 'true';

/** Open bills, oldest first; `mine` = only the signed-in person's tables. */
export const getBills = USE_MOCK_BILLS
  ? async (options: { mine?: boolean } = {}) => {
      const open = openBills(await mock.getBills());
      const userId = useSession.getState().user?.userId;
      return options.mine ? open.filter((b) => b.waiterId === userId) : open;
    }
  : real.getBills;

export const getBill = USE_MOCK_BILLS ? mock.getBill : real.getBill;

export { payBill } from '@/lib/api/payments';
// Adding to, changing and cancelling orders need the server (no offline mock).
export { addToBill, cancelOrder, changeOrderItems } from '@/lib/api/orders';
export type { PayRequest, PayResult } from '@/lib/api/payments';

export const billsKey = (scope: 'mine' | 'all') => ['bills', scope] as const;
export const billKey = (id: string) => ['bill', id] as const;
