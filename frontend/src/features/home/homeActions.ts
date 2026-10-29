import type { Href } from 'expo-router';
import {
  ChartColumn,
  CircleDollarSign,
  LayoutDashboard,
  Landmark,
  List,
  ReceiptText,
  ShieldCheck,
  Star,
  type LucideIcon,
} from 'lucide-react-native';

import type { Plan, Role } from '@/store/session';
import { isNormalApp } from '@/lib/variant';

export type HomeActionKey =
  | 'verify'
  | 'newOrder'
  | 'overview'
  | 'tips'
  | 'transactions'
  | 'reports'
  | 'bankAccount'
  | 'subscription';

export interface HomeAction {
  key: HomeActionKey;
  icon: LucideIcon;
  href: Href;
}

const actions: Record<HomeActionKey, HomeAction> = {
  verify: { key: 'verify', icon: ShieldCheck, href: '/verify' },
  newOrder: { key: 'newOrder', icon: ReceiptText, href: '/orders' },
  overview: { key: 'overview', icon: LayoutDashboard, href: '/admin' },
  tips: { key: 'tips', icon: CircleDollarSign, href: '/tips' },
  transactions: { key: 'transactions', icon: List, href: '/transactions' },
  reports: { key: 'reports', icon: ChartColumn, href: '/reports' },
  bankAccount: { key: 'bankAccount', icon: Landmark, href: '/bank-accounts' },
  subscription: { key: 'subscription', icon: Star, href: '/subscription' },
};

const normalKeys: HomeActionKey[] = [
  'verify',
  'transactions',
  'reports',
  'bankAccount',
  'subscription',
];

// Restaurant features come first; exploring users see everything.
const restaurantKeys: HomeActionKey[] = [
  'verify',
  'newOrder',
  'tips',
  'transactions',
  'reports',
  'bankAccount',
  'subscription',
];

export function getHomeActions(plan: Plan | null, role: Role): HomeAction[] {
  // Normal and Normal Multi: no restaurant buttons. No plan yet: everything (not in the Normal app).
  const showRestaurant = plan === 'restaurant' || (plan === null && !isNormalApp);
  const base = showRestaurant ? restaurantKeys : normalKeys;
  // The overview (sales, cash, bank, tips) is for owner and manager on Restaurant Plus.
  const manages = role === 'owner' || role === 'manager';
  const keys: HomeActionKey[] =
    plan === 'restaurant' && manages ? [...base.slice(0, 2), 'overview', ...base.slice(2)] : base;
  // Bank accounts and the subscription are the owner's and manager's.
  const visible = manages ? keys : keys.filter((k) => k !== 'bankAccount' && k !== 'subscription');
  return visible.map((key) => {
    if (key === 'verify' && plan === 'restaurant') return { ...actions.verify, href: '/bills' };
    // Owner and manager see every waiter's tips, not their own.
    if (key === 'tips' && manages) return { ...actions.tips, href: '/tips-admin' };
    return actions[key];
  });
}
