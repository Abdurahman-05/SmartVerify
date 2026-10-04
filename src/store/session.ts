import { create } from 'zustand';

export type Plan = 'normal' | 'restaurant';
export type Role = 'owner' | 'manager' | 'waiter' | 'chef';

export interface SessionUser {
  userId: string;
  displayName: string;
  businessName: string;
  role: Role;
  plan: Plan | null;
}

interface SessionState {
  isAuthenticated: boolean;
  user: SessionUser | null;
  signIn: (user: SessionUser) => void;
  setPlan: (plan: Plan) => void;
  signOut: () => void;
}

export const useSession = create<SessionState>((set) => ({
  isAuthenticated: false,
  user: null,
  signIn: (user) => set({ isAuthenticated: true, user }),
  setPlan: (plan) => set((state) => ({ user: state.user ? { ...state.user, plan } : null })),
  signOut: () => set({ isAuthenticated: false, user: null }),
}));
