import type { OrderLine, TableArea } from '@/lib/mock/restaurant';

export type BillType = 'dine' | 'takeaway' | 'delivery';

/** One order on a bill (the server sends these; the mock does not). */
export interface BillOrder {
  id: string;
  number: number;
  kitchenStatus: 'new' | 'cooking' | 'ready';
  edited: boolean;
  cancelled: boolean;
  cancelReason: string | null;
  items: { menuItemId: string | null; name: string; priceEtb: number; quantity: number }[];
}

export interface Bill {
  id: string;
  orderNo: number;
  type: BillType;
  tableNo?: number;
  tableArea?: TableArea;
  /** Amharic name of the table's category (the server sends it when there is one). */
  tableAreaAm?: string;
  guests?: number;
  customerName?: string;
  phone?: string;
  area?: string;
  address?: string;
  items: OrderLine[];
  /** Per order, to change or cancel one before cooking. */
  orders?: BillOrder[];
  foodTotal: number;
  packingFee: number;
  deliveryFee: number;
  total: number;
  waiterId: string;
  waiterName: string;
  status: 'open' | 'paid' | 'cancelled';
  servedStatus: 'kitchen' | 'served';
  createdAt: string;
}
