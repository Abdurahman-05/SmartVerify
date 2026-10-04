import { create } from 'zustand';

export type Plan = 'normal' | 'restaurant';
export type Role = 'owner' | 'manager' | 'waiter' | 'chef';

export interface SessionUser {
  userId: string;
  role: Role;
  plan: Plan | null;
}

interface SessionState {
  isAuthenticated: boolean;
  userId: string | null;
  role: Role | null;
  plan: Plan | null;
  signIn: (user: SessionUser) => void;
  setPlan: (plan: Plan) => void;
  signOut: () => void;
}

export const useSession = create<SessionState>((set) => ({
  isAuthenticated: false,
  userId: null,
  role: null,
  plan: null,
  signIn: ({ userId, role, plan }) => set({ isAuthenticated: true, userId, role, plan }),
  setPlan: (plan) => set({ plan }),
  signOut: () => set({ isAuthenticated: false, userId: null, role: null, plan: null }),
}));
