import * as real from '@/lib/api/reports';
import * as mock from '@/lib/mock/reports';

export type {
  ExpenseKind,
  ExpensesReport,
  FoodReport,
  ReportAccess,
  ReportDays,
  SalesReport,
  StaffReport,
} from '@/lib/api/reports';

/** EXPO_PUBLIC_USE_MOCK_REPORTS=true uses the offline mock; default is the real backend. */
export const USE_MOCK_REPORTS = process.env.EXPO_PUBLIC_USE_MOCK_REPORTS === 'true';

const impl = USE_MOCK_REPORTS ? mock : real;
export const getSalesReport = impl.getSalesReport;
export const getFoodReport = impl.getFoodReport;
export const getExpensesReport = impl.getExpensesReport;
export const getStaffReport = impl.getStaffReport;
export const getReportAccess = impl.getReportAccess;
export const setReportAccess = impl.setReportAccess;

export type ReportTab = 'sales' | 'food' | 'expenses' | 'staff';

/** React Query keys: each tab is its own query, fetched only when that tab is open. */
export const reportKey = (tab: ReportTab, days: real.ReportDays) =>
  ['report', tab, days.from, days.to] as const;
export const reportAccessKey = ['report-access'] as const;

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Today, the last 7 or 30 days (today included), or one chosen day — as from/to days. */
export function daysOf(period: 'today' | '7d' | '30d', day?: string, now = new Date()) {
  if (day) return { from: day, to: day };
  const start = new Date(now);
  start.setDate(now.getDate() - (period === '7d' ? 6 : period === '30d' ? 29 : 0));
  return { from: ymd(start), to: ymd(now) };
}
