import * as real from '@/lib/api/staff';
import * as mock from '@/lib/mock/staffAdmin';

export type { NewStaffInput, StaffChanges, StaffMember, StaffRole } from '@/lib/mock/staffAdmin';

/** EXPO_PUBLIC_USE_MOCK_STAFF=true uses the offline mock (src/lib/mock/staffAdmin.ts); default is the real backend. */
export const USE_MOCK_STAFF = process.env.EXPO_PUBLIC_USE_MOCK_STAFF === 'true';

export const getStaff = USE_MOCK_STAFF ? mock.getStaff : real.getStaff;
export const addStaff = USE_MOCK_STAFF ? mock.addStaff : real.addStaff;
export const updateStaff = USE_MOCK_STAFF ? mock.updateStaff : real.updateStaff;
export const resetStaffPin = USE_MOCK_STAFF ? mock.resetStaffPin : real.resetStaffPin;

export const staffKey = ['staff'] as const;

/** A random 4-digit PIN to offer when the owner does not want to think of one. */
export function randomPin(): string {
  const values = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(values);
  else values[0] = Math.floor(Math.random() * 0xffffffff);
  return String(values[0] % 10000).padStart(4, '0');
}
