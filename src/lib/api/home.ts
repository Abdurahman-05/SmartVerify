import { mockDelay } from './mock';

export interface TodaySummary {
  verified: number;
  pending: number;
  duplicate: number;
  tablesWaiting: number;
}

export async function getTodaySummary(): Promise<TodaySummary> {
  await mockDelay(800);
  return { verified: 24, pending: 2, duplicate: 1, tablesWaiting: 3 };
}
