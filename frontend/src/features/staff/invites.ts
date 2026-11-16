import { create } from 'zustand';

import type { StaffMember } from '@/lib/mock/staffAdmin';

interface InvitesState {
  /** Managers invited by email who have not accepted yet (shown in the Staff list). */
  invites: StaffMember[];
  /** One-line "Invite sent to …" message the Staff list shows for a moment. */
  notice: string | null;
  add: (invite: StaffMember, notice: string) => void;
  clearNotice: () => void;
}

export const useInvites = create<InvitesState>((set) => ({
  invites: [],
  notice: null,
  add: (invite, notice) => set((s) => ({ invites: [...s.invites, invite], notice })),
  clearNotice: () => set({ notice: null }),
}));
