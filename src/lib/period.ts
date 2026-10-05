export type Period = 'today' | '7d' | '30d';

export const periods: Period[] = ['today', '7d', '30d'];

export const isPeriod = (value: unknown): value is Period =>
  typeof value === 'string' && (periods as string[]).includes(value);

const DAYS: Record<Period, number> = { today: 1, '7d': 7, '30d': 30 };

/** Start of the period (local midnight) and now. */
export function periodRange(period: Period, now = new Date()) {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (DAYS[period] - 1));
  return { from, to: now };
}
