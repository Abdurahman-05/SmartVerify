import type { MenuAdminItem, MenuItemChanges, MenuItemInput } from '@/lib/mock/menu';

import { api } from './client';
import { newIdempotencyKey } from './idempotency';

/** GET /menu?all=true — every item of the business, including ones turned off. */
export const getMenuItems = () => api<MenuAdminItem[]>('/menu', { query: { all: 'true' } });

/** POST /menu. Pass the same key when retrying the same "add", so it is saved once. */
export const addMenuItem = (input: MenuItemInput, idempotencyKey = newIdempotencyKey()) =>
  api<MenuAdminItem>('/menu', { method: 'POST', body: input, idempotencyKey });

/** PATCH /menu/:id — name, price, category, or on/off. */
export const updateMenuItem = (id: string, changes: MenuItemChanges) =>
  api<MenuAdminItem>(`/menu/${encodeURIComponent(id)}`, { method: 'PATCH', body: changes });
