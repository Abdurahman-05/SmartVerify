import type { BillType } from '@/features/bills/types';

export type KitchenStatus = 'new' | 'cooking' | 'ready';

export interface KitchenOrder {
  id: string;
  billId: string;
  orderNo: number;
  label: string;
  type: BillType;
  waiterName: string;
  guests?: number;
  area?: string;
  customerName?: string;
  items: { qty: number; name: string }[];
  /** Kitchen note keys (orders.note.*), e.g. "noOnion". */
  notes: string[];
  status: KitchenStatus;
  createdAt: string;
  startedAt?: string;
}
