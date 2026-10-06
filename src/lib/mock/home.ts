import { mockDelay } from './mock';
import { getTodayCounts } from './transactions';

export interface TodaySummary {
  verified: number;
  pending: number;
  duplicate: number;
  tablesWaiting: number;
}

export async function getTodaySummary(): Promise<TodaySummary> {
  await mockDelay(800);
  return { ...(await getTodayCounts()), tablesWaiting: 3 };
}
