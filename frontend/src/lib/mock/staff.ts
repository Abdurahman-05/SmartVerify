import { useStaff } from '@/features/staff/store';
import type { Staff } from '@/features/staff/types';

import { mockDelay } from './mock';

/*
 * Test sign-ins (phone without +251 · PIN):
 *   Owner    Abebe     912345678 · 123456  (Restaurant Plus)
 *   Waiter   Dawit G.  911111111 · 1111
 *   Waiter   Selam T.  922222222 · 2222
 *   Chef     Hana M.   933333333 · 3333
 *   Manager  Yonas B.  944444444 · 4444   (Off: cannot sign in until set Active)
 * Create Account replaces the owner with the new account.
 */

export async function getStaff(): Promise<Staff[]> {
  await mockDelay(300);
  return useStaff.getState().staff;
}
