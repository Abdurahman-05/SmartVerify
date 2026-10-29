/** Offline sample inbox (EXPO_PUBLIC_USE_MOCK_NOTIFICATIONS=true). */
export type NotificationType =
  | 'new_order'
  | 'order_ready'
  | 'big_payment'
  | 'bad_receipt'
  | 'daily_summary'
  | 'plan_ending'
  | 'plan_late';

export interface AppNotification {
  id: string;
  type: NotificationType | string;
  /** Values for the text (order number, table, amount…); the app writes the sentence. */
  data: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

export interface Inbox {
  unread: number;
  items: AppNotification[];
}

let items: AppNotification[] = [
  {
    id: 'n1',
    type: 'big_payment',
    data: { amountEtb: 6500, bankCode: 'CBE', payerName: 'Kebede Alemu' },
    read: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'n2',
    type: 'daily_summary',
    data: { count: 14, totalEtb: 18250 },
    read: true,
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
  },
];

export async function getNotifications(): Promise<Inbox> {
  await Promise.resolve();
  return { unread: items.filter((n) => !n.read).length, items };
}

export async function markNotificationsRead(ids?: string[]): Promise<void> {
  await Promise.resolve();
  items = items.map((n) => (!ids || ids.includes(n.id) ? { ...n, read: true } : n));
}
