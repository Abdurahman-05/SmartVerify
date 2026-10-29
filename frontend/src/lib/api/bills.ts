import type { Bill, BillOrder, BillType } from '@/features/bills/types';

import { api, ApiError } from './client';

/** Bill fields every server bill has (GET /bills items). */
interface ServerBillListItem {
  id: string;
  type: BillType;
  tableNumber: number | null;
  tableCategory: string | null;
  tableCategoryAm: string | null;
  guests: number | null;
  customerName: string | null;
  deliveryAreaName: string | null;
  orderNo: number;
  waiterId: string;
  waiterName: string;
  status: 'open' | 'paid' | 'cancelled';
  servedStatus: 'kitchen' | 'served';
  totalEtb: number;
  createdAt: string;
}

/** GET /bills/:id */
interface ServerBillDetail extends ServerBillListItem {
  customerPhone: string | null;
  address: string | null;
  foodTotalEtb: number;
  packingFeeEtb: number;
  deliveryFeeEtb: number;
  orders: BillOrder[];
}

const base = (
  b: ServerBillListItem
): Omit<Bill, 'items' | 'foodTotal' | 'packingFee' | 'deliveryFee'> => ({
  id: b.id,
  orderNo: b.orderNo,
  type: b.type,
  tableNo: b.tableNumber ?? undefined,
  tableArea: b.tableCategory ?? undefined,
  tableAreaAm: b.tableCategoryAm ?? undefined,
  guests: b.guests ?? undefined,
  customerName: b.customerName ?? undefined,
  area: b.deliveryAreaName ?? undefined,
  total: b.totalEtb,
  waiterId: b.waiterId,
  waiterName: b.waiterName,
  status: b.status,
  servedStatus: b.servedStatus,
  createdAt: b.createdAt,
});

/**
 * GET /bills?status=open — open bills, oldest first. `mine` = only the signed-in member's bills
 * (waiters only ever get their own). The list has no item lines; open the bill for those.
 */
export async function getBills(options: { mine?: boolean } = {}): Promise<Bill[]> {
  const { items } = await api<{ items: ServerBillListItem[] }>('/bills', {
    query: { status: 'open', limit: '100', ...(options.mine && { mine: 'true' }) },
  });
  return items
    .map((b) => ({ ...base(b), items: [], foodTotal: b.totalEtb, packingFee: 0, deliveryFee: 0 }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** GET /bills/:id — every line of every order on the bill, with the server's totals. */
export async function getBill(id: string): Promise<Bill | null> {
  try {
    const b = await api<ServerBillDetail>(`/bills/${encodeURIComponent(id)}`);
    return {
      ...base(b),
      phone: b.customerPhone ?? undefined,
      address: b.address ?? undefined,
      // Cancelled orders are not on the bill (they still show in `orders`).
      items: b.orders
        .filter((order) => !order.cancelled)
        .flatMap((order) =>
          order.items.map((item, i) => ({
            itemId: `${order.id}-${i}`,
            name: item.name,
            priceEtb: item.priceEtb,
            quantity: item.quantity,
          }))
        ),
      orders: b.orders,
      foodTotal: b.foodTotalEtb,
      packingFee: b.packingFeeEtb,
      deliveryFee: b.deliveryFeeEtb,
    };
  } catch (error) {
    if (error instanceof ApiError && error.code === 'NOT_FOUND') return null;
    throw error;
  }
}
