import type { Tip } from '@/features/tips/types';
import type { Period } from '@/lib/period';

import { api } from './client';

interface ServerTip {
  id: string;
  billId: string;
  label: string;
  amountEtb: number;
  source: 'bank' | 'cash';
  waiterId: string;
  waiterName: string;
  paidOut: boolean;
  createdAt: string;
}

const toTip = (t: ServerTip): Tip => ({
  id: t.id,
  billId: t.billId,
  label: t.label,
  amount: t.amountEtb,
  source: t.source,
  waiterId: t.waiterId,
  waiterName: t.waiterName,
  createdAt: t.createdAt,
  paidOut: t.paidOut,
});

/** GET /tips — tips in the period, newest first. `mine` = only the signed-in person's. */
export async function getTips(period: Period, options: { mine?: boolean } = {}): Promise<Tip[]> {
  const tips = await api<ServerTip[]>('/tips', {
    query: { period, ...(options.mine && { mine: 'true' }) },
  });
  return tips.map(toTip);
}

/** POST /tips/mark-paid — the owner/manager paid these tips out to their waiters. */
export async function markTipsPaid(tipIds: string[]): Promise<void> {
  await api('/tips/mark-paid', { method: 'POST', body: { tipIds } });
}
