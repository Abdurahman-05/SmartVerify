import { Redirect } from 'expo-router';

import HomeScreen from '@/features/home/HomeScreen';
import { useSession } from '@/store/session';

/**
 * Restaurant waiters work from their own tabs (New order first); everyone else gets Home.
 * Workers on the Normal plans have no New order tab: they stay here (else the two tabs would
 * send each other back and forth forever).
 */
export default function HomeTab() {
  const isWaiter = useSession((s) => s.user?.role === 'waiter' && s.user.plan === 'restaurant');
  return isWaiter ? <Redirect href="/new-order" /> : <HomeScreen />;
}
