import type { Inbox } from '@/lib/mock/notifications';

import { api } from './client';

/** GET /notifications — your latest notifications and how many are unread. */
export const getNotifications = () => api<Inbox>('/notifications');

/** POST /notifications/read — mark these as read (all of yours without ids). */
export async function markNotificationsRead(ids?: string[]): Promise<void> {
  await api('/notifications/read', { method: 'POST', body: ids ? { ids } : {} });
}
