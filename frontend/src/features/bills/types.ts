import type { OrderLine, TableArea } from '@/lib/mock/restaurant';

export type BillType = 'dine' | 'takeaway' | 'delivery';

export interface Bill {
  id: string;
  orderNo: number;
  type: BillType;
  tableNo?: number;
  tableArea?: TableArea;
  guests?: number;
  customerName?: string;
  phone?: string;
  area?: string;
  address?: string;
  items: OrderLine[];
  foodTotal: number;
  packingFee: number;
  deliveryFee: number;
  total: number;
  waiterId: string;
  waiterName: string;
  status: 'open' | 'paid';
  servedStatus: 'kitchen' | 'served';
  createdAt: string;
}
