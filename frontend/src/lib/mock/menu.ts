import { mockDelay } from './mock';
import { getMenu, type MenuCategory, type MenuItem } from './restaurant';

/** A menu item as the owner/manager Menu screen sees it, including items turned off. */
export interface MenuAdminItem extends MenuItem {
  /** false = "Finished today": hidden from New order. */
  active: boolean;
  /** Amharic name, shown when the app is in Amharic. */
  nameAm?: string | null;
  /** Section, e.g. "Meat & Tibs" (from a starter menu). */
  groupName?: string | null;
}

export interface MenuItemInput {
  name: string;
  priceEtb: number;
  category: MenuCategory;
}

export type MenuItemChanges = Partial<MenuItemInput & { active: boolean }>;

// Starts from the New order mock menu; changes here stay in this mock only.
let items: MenuAdminItem[] | null = null;
const load = async () => (items ??= (await getMenu()).map((item) => ({ ...item, active: true })));

export async function getMenuItems(): Promise<MenuAdminItem[]> {
  const all = await load();
  return [...all];
}

export async function addMenuItem(
  input: MenuItemInput,
  _idempotencyKey?: string
): Promise<MenuAdminItem> {
  await mockDelay(600);
  const item: MenuAdminItem = {
    ...input,
    name: input.name.trim(),
    id: `m-${Date.now()}`,
    active: true,
  };
  items = [...(await load()), item];
  return item;
}

export async function updateMenuItem(id: string, changes: MenuItemChanges): Promise<MenuAdminItem> {
  await mockDelay(400);
  const current = (await load()).find((item) => item.id === id);
  if (!current) throw new Error('NOT_FOUND');
  const updated = { ...current, ...changes };
  items = (await load()).map((item) => (item.id === id ? updated : item));
  return updated;
}
