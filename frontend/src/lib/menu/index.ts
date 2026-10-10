import * as real from '@/lib/api/menu';
import * as mock from '@/lib/mock/menu';

export type { MenuAdminItem, MenuItemChanges, MenuItemInput } from '@/lib/mock/menu';

/** EXPO_PUBLIC_USE_MOCK_MENU=true uses the offline mock (src/lib/mock/menu.ts); default is the real backend. */
export const USE_MOCK_MENU = process.env.EXPO_PUBLIC_USE_MOCK_MENU === 'true';

export const getMenuItems = USE_MOCK_MENU ? mock.getMenuItems : real.getMenuItems;
export const addMenuItem = USE_MOCK_MENU ? mock.addMenuItem : real.addMenuItem;
export const updateMenuItem = USE_MOCK_MENU ? mock.updateMenuItem : real.updateMenuItem;

/** React Query key for the Menu screens. */
export const menuAdminKey = ['menu', 'admin'] as const;
