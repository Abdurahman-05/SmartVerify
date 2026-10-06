import type { Bill } from '@/features/bills/types';
import { useKitchen } from '@/features/kitchen/store';
import type { KitchenOrder } from '@/features/kitchen/types';
import { billLabel } from '@/features/verify/billLabel';
import i18n from '@/i18n';

import { mockDelay } from './mock';

export async function getKitchenOrders(): Promise<KitchenOrder[]> {
  await mockDelay(300);
  return useKitchen.getState().orders;
}

/** Sends a new bill's items and notes to the chef's screen. */
export function createKitchenOrder(bill: Bill, notes: string[]): KitchenOrder {
  const order: KitchenOrder = {
    id: `k-${bill.orderNo}`,
    billId: bill.id,
    orderNo: bill.orderNo,
    label: billLabel(i18n.t, bill),
    type: bill.type,
    waiterName: bill.waiterName,
    guests: bill.guests,
    area: bill.area,
    customerName: bill.customerName,
    items: bill.items.map((l) => ({ qty: l.quantity, name: l.name })),
    notes,
    status: 'new',
    createdAt: bill.createdAt,
  };
  useKitchen.getState().addOrder(order);
  return order;
}
