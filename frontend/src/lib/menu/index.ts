import * as real from '@/lib/api/menu';
import type { MenuAdminItem, MenuItemChanges, MenuItemInput } from '@/lib/api/menu';
import * as mock from '@/lib/mock/menu';
import * as mockCatalog from '@/lib/mock/menuCatalog';

export type { MenuAdminItem, MenuItemChanges, MenuItemInput } from '@/lib/api/menu';
export type {
  CatalogImportInput,
  CatalogImportResult,
  CatalogItem,
  CatalogPack,
  CatalogSection,
} from '@/lib/mock/menuCatalog';

/** EXPO_PUBLIC_USE_MOCK_MENU=true uses the offline mock (src/lib/mock/menu*.ts); default is the real backend. */
export const USE_MOCK_MENU = process.env.EXPO_PUBLIC_USE_MOCK_MENU === 'true';

export const getMenuItems: () => Promise<MenuAdminItem[]> = USE_MOCK_MENU
  ? mock.getMenuItems
  : real.getMenuItems;
export const addMenuItem: (
  input: MenuItemInput,
  idempotencyKey?: string
) => Promise<MenuAdminItem> = USE_MOCK_MENU ? mock.addMenuItem : real.addMenuItem;
export const updateMenuItem: (id: string, changes: MenuItemChanges) => Promise<MenuAdminItem> =
  USE_MOCK_MENU ? mock.updateMenuItem : real.updateMenuItem;
export const removeMenuItem = USE_MOCK_MENU ? mock.removeMenuItem : real.removeMenuItem;
export const setMenuItemsActive = USE_MOCK_MENU ? mock.setMenuItemsActive : real.setMenuItemsActive;

export const getCatalogPacks = USE_MOCK_MENU ? mockCatalog.getCatalogPacks : real.getCatalogPacks;
export const getCatalogItems = USE_MOCK_MENU ? mockCatalog.getCatalogItems : real.getCatalogItems;
export const importCatalog = USE_MOCK_MENU ? mockCatalog.importCatalog : real.importCatalog;

/** React Query keys for the Menu screens. */
export const menuAdminKey = ['menu', 'admin'] as const;
export const catalogPacksKey = ['menu', 'catalog', 'packs'] as const;
export const catalogItemsKey = (pack: string) => ['menu', 'catalog', 'items', pack] as const;
