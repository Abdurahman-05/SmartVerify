import { newIdempotencyKey } from './idempotency';
import { api } from './client';

type Lines = { menuItemId: string; quantity: number }[];

/** POST /bills/:id/orders — more items for an open bill (a new kitchen ticket). */
export async function addToBill(
  billId: string,
  items: Lines,
  notes: string[],
  idempotencyKey = newIdempotencyKey()
): Promise<void> {
  await api(`/bills/${encodeURIComponent(billId)}/orders`, {
    method: 'POST',
    body: { items, notes },
    idempotencyKey,
  });
}

/** PUT /orders/:id/items — new items for an order the kitchen has not started. */
export async function changeOrderItems(orderId: string, items: Lines): Promise<void> {
  await api(`/orders/${encodeURIComponent(orderId)}/items`, { method: 'PUT', body: { items } });
}

/** POST /orders/:id/cancel — cancel an order the kitchen has not started. */
export async function cancelOrder(orderId: string, reason: string): Promise<void> {
  await api(`/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: 'POST',
    body: { reason },
  });
}
