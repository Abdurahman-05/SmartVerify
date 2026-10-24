import * as real from '@/lib/api/restaurant';
import { PACKING_FEE_ETB } from '@/lib/mock/fees';
import * as mock from '@/lib/mock/restaurant';

export type { Fees, SendOrderInput, Table } from '@/lib/api/restaurant';
export type {
  DeliveryArea,
  MenuCategory,
  Order,
  OrderLine,
  OrderNote,
  OrderTarget,
  OrderType,
  TableArea,
} from '@/lib/mock/restaurant';

/** A menu item on New order. `categoryId` is the owner's category (the offline mock has none). */
export type MenuItem = mock.MenuItem & { categoryId?: string };

/** EXPO_PUBLIC_USE_MOCK_RESTAURANT=true uses the offline mock (src/lib/mock/restaurant.ts); default is the real backend. */
export const USE_MOCK_RESTAURANT = process.env.EXPO_PUBLIC_USE_MOCK_RESTAURANT === 'true';

export const getMenu: () => Promise<MenuItem[]> = USE_MOCK_RESTAURANT ? mock.getMenu : real.getMenu;
export const getTables: () => Promise<real.Table[]> = USE_MOCK_RESTAURANT
  ? mock.getTables
  : real.getTables;
export const getOrder = USE_MOCK_RESTAURANT ? mock.getOrder : real.getOrder;

export const sendOrder = (input: real.SendOrderInput, idempotencyKey?: string) =>
  USE_MOCK_RESTAURANT ? mock.sendOrder(input) : real.sendOrder(input, idempotencyKey);

// The mock keeps fees as constants.
export const getFees: () => Promise<real.Fees> = USE_MOCK_RESTAURANT
  ? async () => ({ packingFeeEtb: PACKING_FEE_ETB, deliveryAreas: mock.deliveryAreas })
  : real.getFees;

/** React Query keys. */
export const tablesKey = ['tables'] as const;
export const feesKey = ['fees'] as const;
