import { z } from 'zod';

export const periodSchema = z.enum(['today', '7d', '30d']).default('today');
export type Period = z.infer<typeof periodSchema>;

const DAY_MS = 86_400_000;
/** Africa/Addis_Ababa is UTC+3 all year (no daylight saving), so a day starts at 21:00 UTC. */
const ADDIS_OFFSET_MS = 3 * 3_600_000;

/** Start of the period in local (Addis Ababa) days: today, the last 7 days, or the last 30 days. */
export function periodStart(period: Period, now = new Date()): Date {
  const local = now.getTime() + ADDIS_OFFSET_MS;
  const todayStart = Math.floor(local / DAY_MS) * DAY_MS - ADDIS_OFFSET_MS;
  const extraDays = period === 'today' ? 0 : period === '7d' ? 6 : 29;
  return new Date(todayStart - extraDays * DAY_MS);
}
