import type { Href } from 'expo-router';
import { create } from 'zustand';

import { useStaff } from '@/features/staff/store';
import { useFeatures } from '@/store/features';

export type Plan = 'normal' | 'restaurant';
export type Role = 'owner' | 'manager' | 'waiter' | 'chef';

/**
 * First screen after sign in: someone with a temporary PIN chooses their own first; chefs only
 * see the kitchen; an owner without a plan picks one.
 */
export const homeRouteFor = (
  user: { role: Role; plan: Plan | null; pinIsTemporary?: boolean } | null | undefined
): Href => {
  if (user?.pinIsTemporary) return '/change-pin';
  if (user?.role === 'chef') return '/kitchen';
  if (user?.role === 'owner' && user.plan === null) return '/choose-plan';
  return '/home';
};

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
  /** 9 digits without +251, e.g. "912345678". */
  phone?: string;
  role: Role;
  /** The owner or a manager set this PIN: it must be changed before using the app. */
  pinIsTemporary?: boolean;
  plan: Plan | null;
  subscription: Subscription | null;
}

interface SessionState {
  isAuthenticated: boolean;
  user: SessionUser | null;
  signIn: (user: SessionUser) => void;
  setPlan: (plan: Plan) => void;
  setRole: (role: Role) => void;
  /** The person chose their own PIN. */
  pinChanged: () => void;
  setSubscription: (subscription: Subscription) => void;
  signOut: () => void;
}

export const useSession = create<SessionState>((set) => ({
  isAuthenticated: false,
  user: null,
  signIn: (user) => set({ isAuthenticated: true, user }),
  setPlan: (plan) =>
    set((state) => {
      if (state.user?.role === 'owner') useStaff.getState().setOwnerPlan(plan);
      return { user: state.user ? { ...state.user, plan } : null };
    }),
  setRole: (role) => set((state) => ({ user: state.user ? { ...state.user, role } : null })),
  pinChanged: () =>
    set((state) => ({ user: state.user ? { ...state.user, pinIsTemporary: false } : null })),
  setSubscription: (subscription) =>
    set((state) => {
      if (state.user?.role === 'owner')
        useStaff.getState().setOwnerPlan(subscription.plan, subscription);
      return { user: state.user ? { ...state.user, plan: subscription.plan, subscription } : null };
    }),
  signOut: () => {
    useFeatures.getState().reset();
    set({ isAuthenticated: false, user: null });
  },
}));
