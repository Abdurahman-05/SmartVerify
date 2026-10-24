import type {
  MenuCategoryChanges,
  MenuCategoryEntry,
  MenuCategoryInput,
} from '@/lib/mock/menuCategories';

import { api } from './client';

/** GET /menu/categories — the business's categories in the owner's order, with item counts. */
export const getMenuCategories = () => api<MenuCategoryEntry[]>('/menu/categories');

/** POST /menu/categories — owner and manager. A name already used gives CATEGORY_DUPLICATE. */
export const addMenuCategory = (input: MenuCategoryInput) =>
  api<MenuCategoryEntry>('/menu/categories', { method: 'POST', body: input });

/** PATCH /menu/categories/:id — rename (Amharic name null clears it). */
export const updateMenuCategory = (id: string, changes: MenuCategoryChanges) =>
  api<MenuCategoryEntry>(`/menu/categories/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: changes,
  });

/** DELETE /menu/categories/:id — only an empty category (else CATEGORY_NOT_EMPTY). */
export async function removeMenuCategory(id: string): Promise<void> {
  await api(`/menu/categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
