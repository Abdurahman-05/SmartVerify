import type { Href } from 'expo-router';
import { create } from 'zustand';

export type Plan = 'normal' | 'restaurant';
export type Role = 'owner' | 'manager' | 'waiter' | 'chef';

/** First screen after sign in: chefs only see the kitchen. */
export const homeRouteFor = (role: Role | null | undefined): Href =>
  role === 'chef' ? '/kitchen' : '/home';

export type BillingPeriod = 'monthly' | 'quarterly';

export interface Subscription {
  plan: Plan;
  period: BillingPeriod;
  priceEtb: number;
  startedAt: string;
  endsAt: string;
}

export interface SessionUser {
  userId: string;
  displayName: string;
  businessName: string;
  role: Role;
  plan: Plan | null;
  subscription: Subscription | null;
}

interface SessionState {
  isAuthenticated: boolean;
  user: SessionUser | null;
  signIn: (user: SessionUser) => void;
  setPlan: (plan: Plan) => void;
  setSubscription: (subscription: Subscription) => void;
  signOut: () => void;
}

export const useSession = create<SessionState>((set) => ({
  isAuthenticated: false,
  user: null,
  signIn: (user) => set({ isAuthenticated: true, user }),
  setPlan: (plan) => set((state) => ({ user: state.user ? { ...state.user, plan } : null })),
  setSubscription: (subscription) =>
    set((state) => ({
      user: state.user ? { ...state.user, plan: subscription.plan, subscription } : null,
    })),
  signOut: () => set({ isAuthenticated: false, user: null }),
}));
