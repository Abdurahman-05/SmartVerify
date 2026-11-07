import type { Href } from 'expo-router';
import {
  Banknote,
  ChartColumn,
  CircleDollarSign,
  LayoutDashboard,
  Landmark,
  List,
  NotebookPen,
  ReceiptText,
  ShieldCheck,
  Wallet,
  Star,
  type LucideIcon,
} from 'lucide-react-native';

import type { Plan, Role } from '@/store/session';
import { isNormalApp } from '@/lib/variant';

export type HomeActionKey =
  | 'verify'
  | 'newOrder'
  | 'overview'
  | 'moneyFlow'
  | 'buyList'
  | 'moneyOut'
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
  moneyFlow: { key: 'moneyFlow', icon: Wallet, href: '/money-flow' },
  buyList: { key: 'buyList', icon: NotebookPen, href: '/buy-list' },
  moneyOut: { key: 'moneyOut', icon: Banknote, href: '/money-out' },
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

/** The owner extras switched on (Restaurant Plus): each adds its Home tiles for owner and manager. */
export function getHomeActions(
  plan: Plan | null,
  role: Role,
  extras: { buyList: boolean; moneyOut: boolean; reports?: boolean } = {
    buyList: false,
    moneyOut: false,
  }
): HomeAction[] {
  // Normal and Normal Multi: no restaurant buttons. No plan yet: everything (not in the Normal app).
  const showRestaurant = plan === 'restaurant' || (plan === null && !isNormalApp);
  // Normal plan in the Restaurant app: waiters keep tips from overpaid receipts.
  const base = showRestaurant
    ? restaurantKeys
    : isNormalApp
      ? normalKeys
      : [...normalKeys.slice(0, 2), 'tips' as const, ...normalKeys.slice(2)];
  // The overview (sales, cash, bank, tips) is for owner and manager on Restaurant Plus.
  const manages = role === 'owner' || role === 'manager';
  const extra: HomeActionKey[] = [
    'overview',
    ...(extras.moneyOut ? (['moneyFlow', 'moneyOut'] as const) : []),
    ...(extras.buyList ? (['buyList'] as const) : []),
  ];
  const keys: HomeActionKey[] =
    plan === 'restaurant' && manages ? [...base.slice(0, 2), ...extra, ...base.slice(2)] : base;
  // Bank accounts and the subscription are the owner's and manager's.
  const managed = manages ? keys : keys.filter((k) => k !== 'bankAccount' && k !== 'subscription');
  // Restaurant Plus reports: the owner, or a manager while the owner allows it (server decides).
  const visible =
    plan === 'restaurant' && !extras.reports ? managed.filter((k) => k !== 'reports') : managed;
  return visible.map((key) => {
    if (key === 'verify' && plan === 'restaurant') return { ...actions.verify, href: '/bills' };
    // Owner and manager see every waiter's tips, not their own.
    if (key === 'tips' && !showRestaurant) return { ...actions.tips, href: '/verify-tips' };
    if (key === 'tips' && manages) return { ...actions.tips, href: '/tips-admin' };
    return actions[key];
  });
}
