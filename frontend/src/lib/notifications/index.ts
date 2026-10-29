import * as real from '@/lib/api/notifications';
import * as mock from '@/lib/mock/notifications';

export type { AppNotification, Inbox, NotificationType } from '@/lib/mock/notifications';

/** EXPO_PUBLIC_USE_MOCK_NOTIFICATIONS=true uses the offline mock; default is the real backend. */
export const USE_MOCK_NOTIFICATIONS = process.env.EXPO_PUBLIC_USE_MOCK_NOTIFICATIONS === 'true';

export const getNotifications = USE_MOCK_NOTIFICATIONS
  ? mock.getNotifications
  : real.getNotifications;
export const markNotificationsRead = USE_MOCK_NOTIFICATIONS
  ? mock.markNotificationsRead
  : real.markNotificationsRead;

export const notificationsKey = ['notifications'] as const;
/** The unread badge checks this often while the app is open. */
export const NOTIFICATIONS_POLL_MS = 30_000;
