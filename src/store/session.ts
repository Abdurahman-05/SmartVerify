import { create } from 'zustand';

export type Plan = 'normal' | 'restaurant';
export type Role = 'owner' | 'manager' | 'waiter' | 'chef';

interface SessionState {
  isAuthenticated: boolean;
  plan: Plan | null;
  role: Role | null;
  userId: string | null;
  setSession: (plan: Plan, role: Role, userId: string) => void;
  clearSession: () => void;
}

export const useSession = create<SessionState>((set) => ({
  isAuthenticated: false,
  plan: null,
  role: null,
  userId: null,
  setSession: (plan, role, userId) =>
    set({ isAuthenticated: true, plan, role, userId }),
  clearSession: () =>
    set({ isAuthenticated: false, plan: null, role: null, userId: null }),
}));
