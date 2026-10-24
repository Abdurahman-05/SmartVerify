import type {
  TableCategoryChanges,
  TableCategoryEntry,
  TableCategoryInput,
} from '@/lib/mock/tableCategories';

import { api } from './client';

/** GET /tables/categories — in the owner's order, with how many tables each has in use. */
export const getTableCategories = () => api<TableCategoryEntry[]>('/tables/categories');

/** POST /tables/categories — owner and manager. A name already used gives CATEGORY_DUPLICATE. */
export const addTableCategory = (input: TableCategoryInput) =>
  api<TableCategoryEntry>('/tables/categories', { method: 'POST', body: input });

/** PATCH /tables/categories/:id — rename (Amharic name null clears it). */
export const updateTableCategory = (id: string, changes: TableCategoryChanges) =>
  api<TableCategoryEntry>(`/tables/categories/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: changes,
  });

/** DELETE /tables/categories/:id — only without tables in use (else CATEGORY_NOT_EMPTY). */
export async function removeTableCategory(id: string): Promise<void> {
  await api(`/tables/categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
