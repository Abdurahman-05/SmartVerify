import type { Period } from '@/lib/period';

import { api } from './client';

type Kind =
  'FOOD' | 'DRINKS' | 'GAS' | 'RENT' | 'SALARY' | 'REPAIRS' | 'TRANSPORT' | 'BILLS' | 'OTHER';

/** GET /reports/restaurant: every restaurant report for a period or one day (server sums). */
export interface RestaurantReport {
  from: string;
  to: string;
  sales: {
    totalEtb: number;
    bills: number;
    averageEtb: number;
    previousEtb: number;
    byHour: { hour: number; totalEtb: number; bills: number }[];
    byDay: { day: string; totalEtb: number; bills: number }[];
    methods: { method: 'cash' | 'bank' | 'cash+bank'; bills: number; totalEtb: number }[];
  };
  menu: {
    items: {
      name: string;
      nameAm: string | null;
      category: string | null;
      qty: number;
      totalEtb: number;
    }[];
    slow: { name: string; nameAm: string | null; qty: number }[];
    categories: { name: string; nameAm: string | null; qty: number; totalEtb: number }[];
    cancelled: {
      orders: number;
      totalEtb: number;
      items: { name: string; qty: number }[];
      list: {
        number: number;
        reason: string | null;
        by: string | null;
        totalEtb: number;
        at: string;
      }[];
    };
  };
  expenses: {
    totalEtb: number;
    byKind: { kind: Kind; totalEtb: number; count: number }[];
    bought: { name: string; times: number; totalEtb: number }[];
    byPerson: {
      name: string;
      count: number;
      cashEtb: number;
      bankEtb: number;
      totalEtb: number;
    }[];
    changed: number;
    deleted: { title: string; amountEtb: number; reason: string | null }[];
  };
  staff: {
    waiters: { name: string; bills: number; salesEtb: number; averageEtb: number }[];
    tips: { name: string; count: number; totalEtb: number; paidOutEtb: number }[];
    checks: {
      ok: number;
      bad: number;
      byBank: { bank: string; ok: number; bad: number }[];
      byPerson: { name: string; ok: number; bad: number }[];
    };
    kitchen: {
      orders: number;
      averageMinutes: number;
      slowest: { name: string; orders: number; averageMinutes: number }[];
    };
  };
}

/** A period, or one calendar day (YYYY-MM-DD) instead. */
export interface ReportRange {
  period: Period;
  day?: string;
}

/** GET /reports/restaurant — owner, or a manager allowed to see reports. */
export const getRestaurantReport = ({ period, day }: ReportRange) =>
  api<RestaurantReport>('/reports/restaurant', { query: { period, date: day } });
