import type { Href } from 'expo-router';
import {
  ChartColumn,
  CircleDollarSign,
  Landmark,
  List,
  ReceiptText,
  ShieldCheck,
  Star,
  type LucideIcon,
} from 'lucide-react-native';

import type { Plan } from '@/store/session';

export type HomeActionKey =
  | 'verify'
  | 'newOrder'
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

export function getHomeActions(plan: Plan | null): HomeAction[] {
  const keys = plan === 'normal' ? normalKeys : restaurantKeys;
  return keys.map((key) =>
    key === 'subscription' && plan === null ? { ...actions[key], href: '/choose-plan' } : actions[key]
  );
}
