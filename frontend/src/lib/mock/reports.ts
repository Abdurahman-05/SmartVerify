import type {
  ExpensesReport,
  FoodReport,
  ReportAccess,
  ReportDays,
  SalesReport,
  StaffReport,
} from '@/lib/api/reports';

/** Offline mock: empty reports (real numbers come from the server). */
const wait = () => new Promise((resolve) => setTimeout(resolve, 200));
const both = { amount: 0, bills: 0 };

export async function getSalesReport(days: ReportDays): Promise<SalesReport> {
  await wait();
  return {
    ...days,
    total: 0,
    bills: 0,
    avgBill: 0,
    previousTotal: 0,
    paidBy: { cash: both, bank: both, both },
    byHour: [],
    byDay: [],
  };
}

export async function getFoodReport(days: ReportDays): Promise<FoodReport> {
  await wait();
  return {
    ...days,
    bestSellers: [],
    byCategory: [],
    slowSellers: [],
    cancelled: { count: 0, amount: 0, topItems: [], orders: [] },
  };
}

export async function getExpensesReport(days: ReportDays): Promise<ExpensesReport> {
  await wait();
  return {
    ...days,
    total: 0,
    sales: 0,
    profit: 0,
    moneyLeft: 0,
    byKind: [],
    boughtItems: [],
    byPerson: [],
    changedByOwner: 0,
    deleted: [],
  };
}

export async function getStaffReport(days: ReportDays): Promise<StaffReport> {
  await wait();
  return {
    ...days,
    waiterSales: [],
    tips: [],
    receiptChecks: { ok: 0, failed: 0, byBank: [], byStaff: [] },
    kitchen: { avgMinutes: 0, orders: 0, slowest: [] },
  };
}

let access: ReportAccess = { managerCanSeeReports: false, canSeeReports: true };
export async function getReportAccess(): Promise<ReportAccess> {
  await wait();
  return access;
}
export async function setReportAccess(managerCanSeeReports: boolean): Promise<ReportAccess> {
  await wait();
  access = { ...access, managerCanSeeReports };
  return access;
}
