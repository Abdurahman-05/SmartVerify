import type { NewStaffInput, StaffChanges, StaffMember } from '@/lib/mock/staffAdmin';

import { api } from './client';

/** GET /staff — the team without the owner. PINs are never sent. */
export const getStaff = () => api<StaffMember[]>('/staff');

/** POST /staff — owner and manager. A phone that already has an account gives PHONE_TAKEN. */
export const addStaff = (input: NewStaffInput) =>
  api<StaffMember>('/staff', { method: 'POST', body: input });

/** PATCH /staff/:id — name, role, permissions, or active (false signs them out at once). */
export const updateStaff = (id: string, changes: StaffChanges) =>
  api<StaffMember>(`/staff/${encodeURIComponent(id)}`, { method: 'PATCH', body: changes });

/** POST /staff/:id/reset-pin — a new temporary 4-digit PIN for someone who forgot theirs. */
export async function resetStaffPin(id: string, pin: string): Promise<void> {
  await api(`/staff/${encodeURIComponent(id)}/reset-pin`, { method: 'POST', body: { pin } });
}
