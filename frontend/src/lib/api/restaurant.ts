import type {
  DeliveryArea,
  MenuItem,
  NewOrderInput,
  Order,
  OrderNote,
  OrderTarget,
  Table,
  TableArea,
} from '@/lib/mock/restaurant';

import { api, ApiError } from './client';
import { newIdempotencyKey } from './idempotency';

/** The delivery target as New order sends it to the server (the server needs the area id). */
export type SendOrderInput = Omit<NewOrderInput, 'target'> & {
  target: OrderTarget & { areaId?: string };
};

export interface Fees {
  packingFeeEtb: number;
  deliveryAreas: DeliveryArea[];
}

/** Bill as the server returns it (GET /bills/:id, POST /orders). */
interface BillDetail {
  id: string;
  type: 'dine' | 'takeaway' | 'delivery';
  tableId: string | null;
  tableNumber: number | null;
  tableArea: TableArea | null;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAreaName: string | null;
  address: string | null;
  waiterId: string;
  waiterName: string;
  foodTotalEtb: number;
  deliveryFeeEtb: number;
  usualDeliveryFeeEtb: number | null;
  createdAt: string;
  orders: {
    id: string;
    number: number;
    createdAt: string;
    notes: OrderNote[];
    items: { name: string; priceEtb: number; quantity: number }[];
  }[];
}

interface ServerMenuItem extends MenuItem {
  nameAm: string | null;
  active: boolean;
}

/** GET /menu — only items that are on (owner/manager also get the ones turned off). */
export async function getMenu(): Promise<MenuItem[]> {
  const items = await api<ServerMenuItem[]>('/menu');
  return items.filter((item) => item.active);
}

/** GET /tables — tables in use; busy = has an open dine-in bill. */
export async function getTables(): Promise<Table[]> {
  const tables = await api<(Table & { openBillId: string | null })[]>('/tables');
  return tables.map(({ id, number, area, busy }) => ({ id, number, area, busy }));
}

/** GET /fees — packing fee and delivery areas with their usual fee. */
export const getFees = () => api<Fees>('/fees');

/** The server's bill shown as the app's Order (the order just sent = the bill's last order). */
function toOrder(bill: BillDetail): Order {
  const order = bill.orders.at(-1);
  const target: OrderTarget =
    bill.type === 'dine'
      ? {
          type: 'dineIn',
          tableId: bill.tableId ?? '',
          tableNumber: bill.tableNumber ?? 0,
          area: bill.tableArea ?? 'main',
        }
      : bill.type === 'takeaway'
        ? {
            type: 'takeaway',
            customerName: bill.customerName ?? '',
            customerPhone: bill.customerPhone ?? undefined,
          }
        : {
            type: 'delivery',
            areaName: bill.deliveryAreaName ?? '',
            deliveryFeeEtb: bill.deliveryFeeEtb,
            usualFeeEtb: bill.usualDeliveryFeeEtb ?? bill.deliveryFeeEtb,
            address: bill.address ?? '',
            customerPhone: bill.customerPhone ?? '',
          };
  return {
    id: bill.id,
    number: order?.number ?? 0,
    target,
    lines: (order?.items ?? []).map((i) => ({
      itemId: '',
      name: i.name,
      priceEtb: i.priceEtb,
      quantity: i.quantity,
    })),
    notes: order?.notes ?? [],
    waiterId: bill.waiterId,
    waiterName: bill.waiterName,
    foodTotalEtb: bill.foodTotalEtb,
    createdAt: order?.createdAt ?? bill.createdAt,
  };
}

/**
 * POST /orders — the server prices everything, creates the bill and the kitchen ticket.
 * Pass the same key when retrying the same order, so it is created once.
 * A delivery fee different from the area's usual fee is then set with PATCH (needs permission);
 * the returned order always shows the fee the server saved.
 */
export async function sendOrder(
  input: SendOrderInput,
  idempotencyKey = newIdempotencyKey()
): Promise<Order> {
  const { target } = input;
  const body = {
    items: input.lines.map((l) => ({ menuItemId: l.itemId, quantity: l.quantity })),
    notes: input.notes,
    ...(target.type === 'dineIn' && { type: 'dine', tableId: target.tableId }),
    ...(target.type === 'takeaway' && {
      type: 'takeaway',
      customerName: target.customerName,
      ...(target.customerPhone && { customerPhone: target.customerPhone }),
    }),
    ...(target.type === 'delivery' && {
      type: 'delivery',
      deliveryAreaId: target.areaId,
      address: target.address,
      customerPhone: target.customerPhone,
    }),
  };
  let bill = await api<BillDetail>('/orders', { method: 'POST', body, idempotencyKey });

  if (target.type === 'delivery' && target.deliveryFeeEtb !== bill.deliveryFeeEtb) {
    try {
      bill = await api<BillDetail>(`/bills/${encodeURIComponent(bill.id)}/delivery-fee`, {
        method: 'PATCH',
        body: { amount: target.deliveryFeeEtb },
      });
    } catch {
      // Not allowed or failed: the order stands with the area's usual fee.
    }
  }
  return toOrder(bill);
}

/** GET /bills/:id — for the "Sent to the kitchen" screen. null when it does not exist. */
export async function getOrder(id: string): Promise<Order | null> {
  try {
    return toOrder(await api<BillDetail>(`/bills/${encodeURIComponent(id)}`));
  } catch (error) {
    if (error instanceof ApiError && error.code === 'NOT_FOUND') return null;
    throw error;
  }
}
