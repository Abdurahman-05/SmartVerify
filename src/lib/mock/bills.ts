import { useBills } from '@/features/bills/store';
import type { Bill } from '@/features/bills/types';

import { PACKING_FEE_ETB } from './fees';
import { mockDelay } from './mock';
import type { Order } from './restaurant';

export async function getBills(): Promise<Bill[]> {
  await mockDelay(300);
  return useBills.getState().bills;
}

export async function getBill(id: string): Promise<Bill | null> {
  await mockDelay(200);
  return useBills.getState().bills.find((b) => b.id === id) ?? null;
}

export function createBill(order: Order, waiterId: string): Bill {
  const { target } = order;
  const packingFee = target.type === 'dineIn' ? 0 : PACKING_FEE_ETB;
  const deliveryFee = target.type === 'delivery' ? target.deliveryFeeEtb : 0;

  const bill: Bill = {
    id: `bill-${order.number}`,
    orderNo: order.number,
    type: target.type === 'dineIn' ? 'dine' : target.type,
    items: order.lines,
    foodTotal: order.foodTotalEtb,
    packingFee,
    deliveryFee,
    total: order.foodTotalEtb + packingFee + deliveryFee,
    waiterId,
    waiterName: order.waiterName,
    status: 'open',
    servedStatus: 'kitchen',
    createdAt: order.createdAt,
    ...(target.type === 'dineIn' && { tableNo: target.tableNumber, tableArea: target.area }),
    ...(target.type === 'takeaway' && { customerName: target.customerName, phone: target.customerPhone }),
    ...(target.type === 'delivery' && {
      area: target.areaName,
      address: target.address,
      phone: target.customerPhone,
    }),
  };
  useBills.getState().addBill(bill);
  return bill;
}

export async function markBillPaid(id: string): Promise<void> {
  await mockDelay(300);
  useBills.getState().markPaid(id);
}
