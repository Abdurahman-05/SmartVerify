export type Period = 'today' | '7d' | '30d';

export const periods: Period[] = ['today', '7d', '30d'];

export const isPeriod = (value: unknown): value is Period =>
  typeof value === 'string' && (periods as string[]).includes(value);

/** History lists (Transactions) can also show everything. */
export type ListPeriod = Period | 'all';
export const isListPeriod = (value: unknown): value is ListPeriod =>
  value === 'all' || isPeriod(value);

const DAYS: Record<Period, number> = { today: 1, '7d': 7, '30d': 30 };

/** A phone-local calendar day as YYYY-MM-DD (what the server takes as `date`). */
export function localDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const isDay = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** Start of the period (local midnight) and now. */
export function periodRange(period: Period, now = new Date()) {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (DAYS[period] - 1));
  return { from, to: now };
}
