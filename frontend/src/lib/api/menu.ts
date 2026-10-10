import type { MenuAdminItem, MenuItemChanges, MenuItemInput } from '@/lib/mock/menu';
import type {
  CatalogImportInput,
  CatalogImportResult,
  CatalogItem,
  CatalogPack,
} from '@/lib/mock/menuCatalog';

import { api } from './client';
import { newIdempotencyKey } from './idempotency';

/** GET /menu?all=true — every item of the business, including ones turned off. */
export const getMenuItems = () => api<MenuAdminItem[]>('/menu', { query: { all: 'true' } });

/** POST /menu. Pass the same key when retrying the same "add", so it is saved once. */
export const addMenuItem = (input: MenuItemInput, idempotencyKey = newIdempotencyKey()) =>
  api<MenuAdminItem>('/menu', { method: 'POST', body: input, idempotencyKey });

/** GET /menu/catalog/packs — starter menus by restaurant type, with sections and counts. */
export const getCatalogPacks = () => api<CatalogPack[]>('/menu/catalog/packs');

/** GET /menu/catalog — starter-menu items, e.g. of one pack. */
export const getCatalogItems = (filters: { pack?: string } = {}) =>
  api<CatalogItem[]>('/menu/catalog', { query: filters });

/** POST /menu/catalog/import — a whole pack, whole sections or single items, in one request. */
export const importCatalog = (input: CatalogImportInput, idempotencyKey = newIdempotencyKey()) =>
  api<CatalogImportResult>('/menu/catalog/import', { method: 'POST', body: input, idempotencyKey });

/** PATCH /menu/:id — name, price, category, or on/off. */
export const updateMenuItem = (id: string, changes: MenuItemChanges) =>
  api<MenuAdminItem>(`/menu/${encodeURIComponent(id)}`, { method: 'PATCH', body: changes });
