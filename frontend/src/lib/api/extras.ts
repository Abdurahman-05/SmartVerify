import type {
  BoughtInput,
  BuyItem,
  BuyStatus,
  Features,
  NewBuyItem,
  NewSpending,
  Spending,
  SpendingsResult,
} from '@/lib/mock/extras';

import { api } from './client';

/** GET /business/features — which owner extras are on (any member). */
export const getFeatures = () => api<Features>('/business/features');

/** PATCH /business/features — owner only. Off only hides a feature; its data is kept. */
export const updateFeatures = (changes: Partial<Features>) =>
  api<Features>('/business/features', { method: 'PATCH', body: changes });

/** GET /buy-items?status= — chef, manager, owner. 403 while the buy list is off. */
export const getBuyItems = (status?: BuyStatus) =>
  api<BuyItem[]>('/buy-items', { query: { status } });

/** POST /buy-items — chef or owner. */
export const addBuyItem = (input: NewBuyItem) =>
  api<BuyItem>('/buy-items', { method: 'POST', body: input });

/** DELETE /buy-items/:id — a chef's own open item, or any item for the owner. */
export async function removeBuyItem(id: string): Promise<void> {
  await api(`/buy-items/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** POST /buy-items/:id/bought — manager or owner. With Money out on, a spending is added too. */
export const markBought = (id: string, input: BoughtInput) =>
  api<BuyItem>(`/buy-items/${encodeURIComponent(id)}/bought`, { method: 'POST', body: input });

/** GET /spendings — today's entries and the totals (manager, owner). 403 while Money out is off. */
export const getSpendings = () => api<SpendingsResult>('/spendings');

/** POST /spendings — manager or owner. */
export const addSpending = (input: NewSpending) =>
  api<Spending>('/spendings', { method: 'POST', body: input });
