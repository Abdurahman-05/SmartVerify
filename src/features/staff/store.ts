import { create } from 'zustand';

import type { Plan, Subscription } from '@/store/session';

import type { OwnerAccount, Staff } from './types';

// Test sign-ins are listed in src/lib/mock/staff.ts.
const seedOwner: OwnerAccount = {
  id: 'mock-user-1',
  name: 'Abebe',
  businessName: 'Abebe Coffee',
  phone: '912345678',
  pin: '123456',
  plan: 'restaurant',
  subscription: {
    plan: 'restaurant',
    period: 'monthly',
    priceEtb: 4000,
    startedAt: new Date(Date.now() - 10 * 86400_000).toISOString(),
    endsAt: new Date(Date.now() + 20 * 86400_000).toISOString(),
  },
};

const staffMember = (s: Omit<Staff, 'canChangeDeliveryFee' | 'canSeeReports' | 'active'> & Partial<Staff>): Staff => ({
  canChangeDeliveryFee: false,
  canSeeReports: false,
  active: true,
  ...s,
});

const seedStaff: Staff[] = [
  staffMember({ id: 'waiter-dawit', name: 'Dawit G.', phone: '911111111', pin: '1111', role: 'waiter' }),
  staffMember({ id: 'waiter-selam', name: 'Selam T.', phone: '922222222', pin: '2222', role: 'waiter' }),
  staffMember({ id: 'chef-hana', name: 'Hana M.', phone: '933333333', pin: '3333', role: 'chef' }),
  staffMember({
    id: 'manager-yonas',
    name: 'Yonas B.',
    phone: '944444444',
    pin: '4444',
    role: 'manager',
    canChangeDeliveryFee: true,
    canSeeReports: true,
    active: false,
  }),
];

interface StaffState {
  owner: OwnerAccount;
  staff: Staff[];
  setOwner: (owner: OwnerAccount) => void;
  setOwnerPlan: (plan: Plan, subscription?: Subscription) => void;
  addStaff: (member: Staff) => void;
  setActive: (id: string, active: boolean) => void;
}

export const useStaff = create<StaffState>((set) => ({
  owner: seedOwner,
  staff: seedStaff,
  setOwner: (owner) => set({ owner }),
  setOwnerPlan: (plan, subscription) =>
    set((s) => ({ owner: { ...s.owner, plan, subscription: subscription ?? s.owner.subscription } })),
  addStaff: (member) => set((s) => ({ staff: [...s.staff, member] })),
  setActive: (id, active) =>
    set((s) => ({ staff: s.staff.map((m) => (m.id === id ? { ...m, active } : m)) })),
}));
