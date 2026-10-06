import { useTips } from '@/features/tips/store';
import type { Tip } from '@/features/tips/types';

import { mockDelay } from './mock';

export async function getTips(): Promise<Tip[]> {
  await mockDelay(300);
  return useTips.getState().tips;
}
