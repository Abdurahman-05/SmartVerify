import { Redirect } from 'expo-router';

import HomeScreen from '@/features/home/HomeScreen';
import { useSession } from '@/store/session';

/** Waiters work from their own tabs (New order first); everyone else gets Home. */
export default function HomeTab() {
  const isWaiter = useSession((s) => s.user?.role === 'waiter');
  return isWaiter ? <Redirect href="/new-order" /> : <HomeScreen />;
}
