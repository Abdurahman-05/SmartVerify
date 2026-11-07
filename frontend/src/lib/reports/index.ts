import * as real from '@/lib/api/reports';
import * as mock from '@/lib/mock/reports';

export type { ReportRange, RestaurantReport } from '@/lib/api/reports';

/** EXPO_PUBLIC_USE_MOCK_REPORTS=true uses the offline mock; default is the real backend. */
export const USE_MOCK_REPORTS = process.env.EXPO_PUBLIC_USE_MOCK_REPORTS === 'true';

const impl = USE_MOCK_REPORTS ? mock : real;
export const getRestaurantReport = impl.getRestaurantReport;

export const restaurantReportKey = (range: real.ReportRange) =>
  ['restaurant-report', range.period, range.day ?? null] as const;
