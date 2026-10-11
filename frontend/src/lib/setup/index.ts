import * as realRestaurant from '@/lib/api/restaurant';
import * as real from '@/lib/api/setup';
import * as mock from '@/lib/mock/setup';

export type { FeesInput } from '@/lib/mock/setup';

/** EXPO_PUBLIC_USE_MOCK_SETUP=true uses the offline mock (src/lib/mock/setup.ts); default is the real backend. */
export const USE_MOCK_SETUP = process.env.EXPO_PUBLIC_USE_MOCK_SETUP === 'true';

export const getSetupTables = USE_MOCK_SETUP ? mock.getSetupTables : realRestaurant.getTables;
export const addTables = USE_MOCK_SETUP ? mock.addTables : real.addTables;
export const removeTable = USE_MOCK_SETUP ? mock.removeTable : real.removeTable;
export const getSetupFees = USE_MOCK_SETUP ? mock.getSetupFees : realRestaurant.getFees;
export const saveFees = USE_MOCK_SETUP ? mock.saveFees : real.saveFees;
