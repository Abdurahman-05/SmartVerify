import { useQuery } from '@tanstack/react-query';

import { billKey, getBill, USE_MOCK_BILLS } from '@/lib/bills';

import { useBills } from './store';
import type { Bill } from './types';

/**
 * The bill being paid: from the server, or from the in-app mock store when bills are mocked.
 * `pending` is true only while the server bill is loading.
 */
export function usePaymentBill(id: string | null | undefined): {
  bill: Bill | undefined;
  pending: boolean;
} {
  const mockBill = useBills((s) => s.bills.find((b) => b.id === id));
  const query = useQuery({
    queryKey: billKey(id ?? ''),
    queryFn: () => getBill(id ?? ''),
    enabled: !USE_MOCK_BILLS && Boolean(id),
  });
  if (USE_MOCK_BILLS) return { bill: mockBill, pending: false };
  return { bill: query.data ?? undefined, pending: Boolean(id) && query.isPending };
}
