import { api } from './client';

/** Days from..to (YYYY-MM-DD, `to` included). */
export interface ReportDays {
  from: string;
  to: string;
}

type Span = { from: string; to: string };
type QtyLine = { name: string; nameAm: string | null; qty: number; amount: number };
type OkFailed = { ok: number; failed: number };
export type ExpenseKind =
  'FOOD' | 'DRINKS' | 'GAS' | 'RENT' | 'SALARY' | 'REPAIRS' | 'TRANSPORT' | 'BILLS' | 'OTHER';

export interface SalesReport extends Span {
  total: number;
  bills: number;
  avgBill: number;
  previousTotal: number;
  paidBy: Record<'cash' | 'bank' | 'both', { amount: number; bills: number }>;
  byHour: { hour: number; amount: number; bills: number }[];
  byDay: { date: string; amount: number; bills: number }[];
}

export interface FoodReport extends Span {
  bestSellers: QtyLine[];
  byCategory: QtyLine[];
  slowSellers: QtyLine[];
  cancelled: {
    count: number;
    amount: number;
    topItems: { name: string; qty: number }[];
    orders: { id: string; number: number; amount: number; waiter: string; reason: string | null }[];
  };
}

export interface ExpensesReport extends Span {
  total: number;
  sales: number;
  profit: number;
  moneyLeft: number;
  byKind: { kind: ExpenseKind; amount: number; count: number }[];
  boughtItems: { name: string; times: number; amount: number }[];
  byPerson: { name: string; total: number; count: number; cash: number; bank: number }[];
  changedByOwner: number;
  deleted: { title: string; amount: number; reason: string | null }[];
}

export interface StaffReport extends Span {
  waiterSales: { name: string; sales: number; bills: number; avgBill: number }[];
  tips: { name: string; total: number; paidOut: number }[];
  receiptChecks: OkFailed & {
    byBank: (OkFailed & { bank: string })[];
    byStaff: (OkFailed & { name: string })[];
  };
  kitchen: {
    avgMinutes: number;
    orders: number;
    slowest: { name: string; minutes: number; orders: number }[];
  };
}

export interface ReportAccess {
  managerCanSeeReports: boolean;
  /** Whether the signed-in member may open Reports. */
  canSeeReports: boolean;
  /** A waiter: the numbers are their own bills only (no Expenses). */
  ownOnly?: boolean;
}

/** GET /reports/sales — owner, or a manager while the owner allows it. */
export const getSalesReport = (days: ReportDays) =>
  api<SalesReport>('/reports/sales', { query: { ...days } });
/** GET /reports/food */
export const getFoodReport = (days: ReportDays) =>
  api<FoodReport>('/reports/food', { query: { ...days } });
/** GET /reports/expenses */
export const getExpensesReport = (days: ReportDays) =>
  api<ExpensesReport>('/reports/expenses', { query: { ...days } });
/** GET /reports/staff */
export const getStaffReport = (days: ReportDays) =>
  api<StaffReport>('/reports/staff', { query: { ...days } });

/** GET /business/report-access — any member. */
export const getReportAccess = () => api<ReportAccess>('/business/report-access');
/** PUT /business/report-access — owner only. */
export const setReportAccess = (managerCanSeeReports: boolean) =>
  api<ReportAccess>('/business/report-access', {
    method: 'PUT',
    body: { managerCanSeeReports },
  });
