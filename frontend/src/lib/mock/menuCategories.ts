import { mockDelay } from './mock';
import type { MenuCategory } from './restaurant';

/** A menu category made by the owner or manager ("Hot drinks", "Fast food"…). */
export interface MenuCategoryEntry {
  id: string;
  name: string;
  /** Amharic name, shown when the app is in Amharic. */
  nameAm: string | null;
  /** food, drinks or combos: what the starter menus use. Not shown to people. */
  kind: MenuCategory;
  sortOrder: number;
  itemCount: number;
}

export interface MenuCategoryInput {
  name: string;
  nameAm?: string;
}

export type MenuCategoryChanges = Partial<{ name: string; nameAm: string | null }>;

// Starts with the three categories every business has; changes stay in this mock only.
let categories: MenuCategoryEntry[] = [
  { id: 'food', name: 'Food', nameAm: 'ምግብ', kind: 'food', sortOrder: 0, itemCount: 0 },
  { id: 'drinks', name: 'Drinks', nameAm: 'መጠጥ', kind: 'drinks', sortOrder: 1, itemCount: 0 },
  { id: 'combos', name: 'Combos', nameAm: 'ጥምር', kind: 'combos', sortOrder: 2, itemCount: 0 },
];

const same = (a: string, b: string) =>
  a.toLowerCase().replace(/\s+/g, '') === b.toLowerCase().replace(/\s+/g, '');

export async function getMenuCategories(): Promise<MenuCategoryEntry[]> {
  return [...categories];
}

export async function addMenuCategory(input: MenuCategoryInput): Promise<MenuCategoryEntry> {
  await mockDelay(400);
  if (categories.some((c) => same(c.name, input.name))) throw new Error('CATEGORY_DUPLICATE');
  const category: MenuCategoryEntry = {
    id: `c-${Date.now()}`,
    name: input.name.trim(),
    nameAm: input.nameAm?.trim() || null,
    kind: 'food',
    sortOrder: categories.length,
    itemCount: 0,
  };
  categories = [...categories, category];
  return category;
}

export async function updateMenuCategory(
  id: string,
  changes: MenuCategoryChanges
): Promise<MenuCategoryEntry> {
  await mockDelay(300);
  const current = categories.find((c) => c.id === id);
  if (!current) throw new Error('NOT_FOUND');
  if (changes.name && categories.some((c) => c.id !== id && same(c.name, changes.name ?? ''))) {
    throw new Error('CATEGORY_DUPLICATE');
  }
  const updated = { ...current, ...changes, name: changes.name?.trim() ?? current.name };
  categories = categories.map((c) => (c.id === id ? updated : c));
  return updated;
}

export async function removeMenuCategory(id: string): Promise<void> {
  await mockDelay(300);
  categories = categories.filter((c) => c.id !== id);
}
