import type { Href } from 'expo-router';

import {
  addMenuCategory,
  getMenuCategories,
  menuCategoriesKey,
  removeMenuCategory,
  updateMenuCategory,
} from '@/lib/menuCategories';
import { tablesKey } from '@/lib/restaurant';
import {
  addTableCategory,
  getTableCategories,
  removeTableCategory,
  tableCategoriesKey,
  updateTableCategory,
} from '@/lib/tableCategories';

export type CategoryKind = 'menu' | 'table';

/** What the category screens show, the same for menu and table categories. */
export interface CategoryRowData {
  id: string;
  name: string;
  nameAm: string | null;
  /** Items (menu) or tables in use (table) inside it. */
  count: number;
}

interface KindConfig {
  queryKey: readonly string[];
  /** Everything to reload after a change. */
  refreshKey: readonly string[];
  list: () => Promise<CategoryRowData[]>;
  add: (input: { name: string; nameAm?: string }) => Promise<unknown>;
  update: (id: string, changes: { name: string; nameAm: string | null }) => Promise<unknown>;
  remove: (id: string) => Promise<void>;
  /** i18n key with a count, e.g. "3 items". */
  countKey: string;
  listRoute: Href;
  formPath: '/menu/category' | '/setup/table-category';
  backRoute: Href;
}

export const categoryKinds: Record<CategoryKind, KindConfig> = {
  menu: {
    queryKey: menuCategoriesKey,
    refreshKey: ['menu'],
    list: async () =>
      (await getMenuCategories()).map(({ itemCount, ...c }) => ({ ...c, count: itemCount })),
    add: addMenuCategory,
    update: updateMenuCategory,
    remove: removeMenuCategory,
    countKey: 'categories.itemCount',
    listRoute: '/menu/categories',
    formPath: '/menu/category',
    backRoute: '/menu',
  },
  table: {
    queryKey: tableCategoriesKey,
    refreshKey: tablesKey,
    list: async () =>
      (await getTableCategories()).map(({ tableCount, ...c }) => ({ ...c, count: tableCount })),
    add: addTableCategory,
    update: updateTableCategory,
    remove: removeTableCategory,
    countKey: 'categories.tableCount',
    listRoute: '/setup/table-categories',
    formPath: '/setup/table-category',
    backRoute: '/setup/tables',
  },
};
