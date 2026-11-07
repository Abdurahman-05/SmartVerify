import type { ReportRange, RestaurantReport } from '@/lib/api/reports';

/** Offline mock: an empty report (real numbers come from the server). */
export async function getRestaurantReport(_range: ReportRange): Promise<RestaurantReport> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const now = new Date().toISOString();
  return {
    from: now,
    to: now,
    sales: {
      totalEtb: 0,
      bills: 0,
      averageEtb: 0,
      previousEtb: 0,
      byHour: [],
      byDay: [],
      methods: [],
    },
    menu: {
      items: [],
      slow: [],
      categories: [],
      cancelled: { orders: 0, totalEtb: 0, items: [], list: [] },
    },
    expenses: { totalEtb: 0, byKind: [], bought: [], byPerson: [], changed: 0, deleted: [] },
    staff: {
      waiters: [],
      tips: [],
      checks: { ok: 0, bad: 0, byBank: [], byPerson: [] },
      kitchen: { orders: 0, averageMinutes: 0, slowest: [] },
    },
  };
}
