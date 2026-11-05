import type { Href } from 'expo-router';

/** Where tapping a notification goes (in the Alerts list, or the push on the lock screen). */
export function targetOf(
  type: string,
  data: Record<string, unknown>,
  role: string | undefined
): Href | null {
  switch (type) {
    case 'new_order':
    case 'order_added':
    case 'order_changed':
      return role === 'chef' ? '/cook' : null;
    case 'big_payment':
    case 'bad_receipt':
      return '/transactions';
    case 'daily_summary':
      return '/reports';
    case 'plan_ending':
    case 'plan_late':
      return role === 'owner' ? '/subscription' : null;
    case 'new_expense':
    case 'expense_deleted':
      return typeof data.spendingId === 'string' ? `/expense/${data.spendingId}` : null;
    default:
      return null;
  }
}
