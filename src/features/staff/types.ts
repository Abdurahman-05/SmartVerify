import type { Plan, Subscription } from '@/store/session';

export type StaffRole = 'manager' | 'waiter' | 'chef';

export interface Staff {
  id: string;
  name: string;
  /** 9 digits without +251. */
  phone: string;
  pin: string;
  role: StaffRole;
  canChangeDeliveryFee: boolean;
  canSeeReports: boolean;
  active: boolean;
}

/** The business owner. Staff share this account's plan. */
export interface OwnerAccount {
  id: string;
  name: string;
  businessName: string;
  phone: string;
  pin: string;
  plan: Plan | null;
  subscription: Subscription | null;
}
