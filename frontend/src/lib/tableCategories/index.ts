import * as real from '@/lib/api/tableCategories';
import * as mock from '@/lib/mock/tableCategories';
import { USE_MOCK_SETUP } from '@/lib/setup';

export type {
  TableCategoryChanges,
  TableCategoryEntry,
  TableCategoryInput,
} from '@/lib/mock/tableCategories';

// Table categories follow the setup switch (EXPO_PUBLIC_USE_MOCK_SETUP).
export const getTableCategories = USE_MOCK_SETUP
  ? mock.getTableCategories
  : real.getTableCategories;
export const addTableCategory = USE_MOCK_SETUP ? mock.addTableCategory : real.addTableCategory;
export const updateTableCategory = USE_MOCK_SETUP
  ? mock.updateTableCategory
  : real.updateTableCategory;
export const removeTableCategory = USE_MOCK_SETUP
  ? mock.removeTableCategory
  : real.removeTableCategory;

export const tableCategoriesKey = ['tables', 'categories'] as const;

/** A table's category key: its category id, or its fixed area in the offline mock. */
export const tableCategoryKey = (table: { categoryId?: string; area: string }) =>
  table.categoryId ?? table.area;
