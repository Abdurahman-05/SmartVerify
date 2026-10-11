import * as real from '@/lib/api/kitchen';
import { useKitchen } from '@/features/kitchen/store';
import * as mock from '@/lib/mock/kitchen';

/** EXPO_PUBLIC_USE_MOCK_KITCHEN=true uses the offline mock (src/lib/mock/kitchen.ts); default is the real backend. */
export const USE_MOCK_KITCHEN = process.env.EXPO_PUBLIC_USE_MOCK_KITCHEN === 'true';

export const getKitchenOrders = USE_MOCK_KITCHEN ? mock.getKitchenOrders : real.getKitchenOrders;

// The mock keeps tickets in the in-app kitchen store. Screens refetch the list afterwards.
export const startCooking: (id: string) => Promise<unknown> = USE_MOCK_KITCHEN
  ? async (id) => useKitchen.getState().startCooking(id)
  : real.startCooking;
export const markReady: (id: string) => Promise<unknown> = USE_MOCK_KITCHEN
  ? async (id) => useKitchen.getState().markReady(id)
  : real.markReady;

export const kitchenKey = ['kitchen', 'orders'] as const;
/** The kitchen refreshes on its own so new orders appear without pulling. */
export const KITCHEN_REFRESH_MS = 20_000;
