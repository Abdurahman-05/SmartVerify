import * as real from '@/lib/api/tips';
import type { Tip } from '@/features/tips/types';
import { USE_MOCK_BILLS } from '@/lib/bills';
import * as mock from '@/lib/mock/tips';
import { periodRange, type Period } from '@/lib/period';
import { useSession } from '@/store/session';

// Tips come from payments, so they follow the bills switch (EXPO_PUBLIC_USE_MOCK_BILLS).

/** Tips in the period, newest first; `mine` = only the signed-in person's. */
export const getTips = USE_MOCK_BILLS
  ? async (period: Period, options: { mine?: boolean } = {}): Promise<Tip[]> => {
      const { from } = periodRange(period);
      const userId = useSession.getState().user?.userId;
      return (await mock.getTips())
        .filter((tip) => !options.mine || tip.waiterId === userId)
        .filter((tip) => new Date(tip.createdAt) >= from)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
  : real.getTips;

/** The mock keeps tips only on the phone, so paying out is not saved there. */
export const markTipsPaid = USE_MOCK_BILLS ? async (_ids: string[]) => {} : real.markTipsPaid;

export const tipsKey = (period: Period, scope: 'mine' | 'all') => ['tips', period, scope] as const;
