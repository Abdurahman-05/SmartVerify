import { Redirect } from 'expo-router';

import NewOrderScreen from '@/features/orders/NewOrderScreen';
import { useSession } from '@/store/session';

/** New order opened on top of Home (owner, manager, Normal-plan staff); waiters use their tab. */
export default function OrdersRoute() {
  const isWaiter = useSession((s) => s.user?.role === 'waiter' && s.user.plan === 'restaurant');
  if (isWaiter) return <Redirect href="/new-order" />;
  return <NewOrderScreen backable />;
}
