import * as real from '@/lib/api/menuCategories';
import { USE_MOCK_MENU } from '@/lib/menu';
import * as mock from '@/lib/mock/menuCategories';

export type {
  MenuCategoryChanges,
  MenuCategoryEntry,
  MenuCategoryInput,
} from '@/lib/mock/menuCategories';

// Categories follow the menu switch (EXPO_PUBLIC_USE_MOCK_MENU).
export const getMenuCategories = USE_MOCK_MENU ? mock.getMenuCategories : real.getMenuCategories;
export const addMenuCategory = USE_MOCK_MENU ? mock.addMenuCategory : real.addMenuCategory;
export const updateMenuCategory = USE_MOCK_MENU ? mock.updateMenuCategory : real.updateMenuCategory;
export const removeMenuCategory = USE_MOCK_MENU ? mock.removeMenuCategory : real.removeMenuCategory;

/** Starts with `menu` so every menu refresh (after adding or removing items) reloads it too. */
export const menuCategoriesKey = ['menu', 'categories'] as const;

/** An item's category key: its category id, or its kind (food, drinks, combos) in the mock. */
export const itemCategoryKey = (item: { categoryId?: string; category: string }) =>
  item.categoryId ?? item.category;
