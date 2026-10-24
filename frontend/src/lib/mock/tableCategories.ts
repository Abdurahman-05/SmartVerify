import { mockDelay } from './mock';

/** A group of tables made by the owner or manager ("Main floor", "VIP", "Garden"…). */
export interface TableCategoryEntry {
  id: string;
  name: string;
  /** Amharic name, shown when the app is in Amharic. */
  nameAm: string | null;
  sortOrder: number;
  tableCount: number;
}

export interface TableCategoryInput {
  name: string;
  nameAm?: string;
}

export type TableCategoryChanges = Partial<{ name: string; nameAm: string | null }>;

// The mock's tables use the fixed area keys as their category, so the ids are those keys.
let categories: TableCategoryEntry[] = [
  { id: 'main', name: 'Main Floor', nameAm: 'ዋናው ወለል', sortOrder: 0, tableCount: 0 },
  { id: 'upstairs', name: 'Upstairs', nameAm: 'ፎቅ ላይ', sortOrder: 1, tableCount: 0 },
  { id: 'outside', name: 'Outside', nameAm: 'ውጪ', sortOrder: 2, tableCount: 0 },
];

const same = (a: string, b: string) =>
  a.toLowerCase().replace(/\s+/g, '') === b.toLowerCase().replace(/\s+/g, '');

export async function getTableCategories(): Promise<TableCategoryEntry[]> {
  return [...categories];
}

export async function addTableCategory(input: TableCategoryInput): Promise<TableCategoryEntry> {
  await mockDelay(400);
  if (categories.some((c) => same(c.name, input.name))) throw new Error('CATEGORY_DUPLICATE');
  const name = input.name.trim();
  // The id doubles as the area the mock tables show, so it is the name.
  const category = {
    id: name,
    name,
    nameAm: input.nameAm?.trim() || null,
    sortOrder: categories.length,
    tableCount: 0,
  };
  categories = [...categories, category];
  return category;
}

export async function updateTableCategory(
  id: string,
  changes: TableCategoryChanges
): Promise<TableCategoryEntry> {
  await mockDelay(300);
  const current = categories.find((c) => c.id === id);
  if (!current) throw new Error('NOT_FOUND');
  const updated = { ...current, ...changes, name: changes.name?.trim() ?? current.name };
  categories = categories.map((c) => (c.id === id ? updated : c));
  return updated;
}

export async function removeTableCategory(id: string): Promise<void> {
  await mockDelay(300);
  categories = categories.filter((c) => c.id !== id);
}
