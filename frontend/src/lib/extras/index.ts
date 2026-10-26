import * as real from '@/lib/api/extras';
import * as mock from '@/lib/mock/extras';

export type {
  BoughtInput,
  BuyItem,
  BuyStatus,
  BuyWhen,
  Features,
  NewBuyItem,
  NewSpending,
  PaidFrom,
  Spending,
  SpendingCategory,
  SpendingsResult,
} from '@/lib/mock/extras';

/** EXPO_PUBLIC_USE_MOCK_EXTRAS=true uses the offline mock (src/lib/mock/extras.ts); default is the real backend. */
export const USE_MOCK_EXTRAS = process.env.EXPO_PUBLIC_USE_MOCK_EXTRAS === 'true';

const impl = USE_MOCK_EXTRAS ? mock : real;
export const getFeatures = impl.getFeatures;
export const updateFeatures = impl.updateFeatures;
export const getBuyItems = impl.getBuyItems;
export const addBuyItem = impl.addBuyItem;
export const removeBuyItem = impl.removeBuyItem;
export const markBought = impl.markBought;
export const getSpendings = impl.getSpendings;
export const addSpending = impl.addSpending;

/** React Query keys. Buy list and money out start with their own name so one call reloads all. */
export const buyItemsKey = ['buy-items'] as const;
export const spendingsKey = ['spendings'] as const;
