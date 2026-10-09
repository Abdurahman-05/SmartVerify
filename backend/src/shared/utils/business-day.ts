export type Period = 'today' | '7d' | '30d';

const DAYS: Record<Period, number> = { today: 1, '7d': 7, '30d': 30 };

/** UTC offset of a time zone at a given instant, in minutes (e.g. Africa/Addis_Ababa -> 180). */
export function timeZoneOffsetMinutes(timeZone: string, at: Date): number {
  const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(at)
    .find((p) => p.type === 'timeZoneName')?.value;
  const match = /GMT([+-])(\d{2}):?(\d{2})?/.exec(part ?? '');
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0));
}

/** Start of the business's local day containing `at`, as a UTC Date. */
export function startOfBusinessDay(timeZone: string, at: Date): Date {
  const offsetMs = timeZoneOffsetMinutes(timeZone, at) * 60_000;
  const local = new Date(at.getTime() + offsetMs);
  const localMidnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(localMidnight - offsetMs);
}

/** [from, to) range for "today", "last 7 days" or "last 30 days" in the business time zone. */
export function periodRange(period: Period, timeZone: string, now = new Date()) {
  const todayStart = startOfBusinessDay(timeZone, now);
  const from = new Date(todayStart.getTime() - (DAYS[period] - 1) * 86_400_000);
  return { from, to: now };
}
