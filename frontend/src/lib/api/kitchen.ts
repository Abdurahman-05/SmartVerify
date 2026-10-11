import type { KitchenOrder } from '@/features/kitchen/types';

import { api } from './client';

interface ServerKitchenOrder extends Omit<
  KitchenOrder,
  'guests' | 'area' | 'customerName' | 'startedAt'
> {
  guests: number | null;
  area: string | null;
  customerName: string | null;
  startedAt: string | null;
}

const toKitchenOrder = (o: ServerKitchenOrder): KitchenOrder => ({
  ...o,
  guests: o.guests ?? undefined,
  area: o.area ?? undefined,
  customerName: o.customerName ?? undefined,
  startedAt: o.startedAt ?? undefined,
});

/** GET /kitchen/orders — new, cooking and recently ready tickets, oldest first. */
export async function getKitchenOrders(): Promise<KitchenOrder[]> {
  return (await api<ServerKitchenOrder[]>('/kitchen/orders')).map(toKitchenOrder);
}

/** POST /kitchen/orders/:id/start */
export const startCooking = async (id: string) =>
  toKitchenOrder(
    await api<ServerKitchenOrder>(`/kitchen/orders/${encodeURIComponent(id)}/start`, {
      method: 'POST',
    })
  );

/** POST /kitchen/orders/:id/ready — also marks the bill served when all its orders are ready. */
export const markReady = async (id: string) =>
  toKitchenOrder(
    await api<ServerKitchenOrder>(`/kitchen/orders/${encodeURIComponent(id)}/ready`, {
      method: 'POST',
    })
  );
