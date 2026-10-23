import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';

import { useSession } from '@/store/session';

/**
 * The app's one React Query client (also used outside components, e.g. after a payment).
 * Loaded data stays for a day: screens show it at once and refresh in the background.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { gcTime: 24 * 60 * 60 * 1000, staleTime: 30 * 1000, retry: 1 },
  },
});

/** Saves loaded data on the phone, so it shows at once after the app is reopened. */
export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'smartverify-cache',
  throttleTime: 2000,
});

/** Saved data is kept for a day. */
export const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

// Signed out: forget this business's data, in memory and on the phone.
useSession.subscribe((state, prev) => {
  if (prev.user && !state.user) {
    queryClient.clear();
    void queryPersister.removeClient();
  }
});

/** Everything that changes when a bill is paid. */
export function refreshAfterPayment() {
  for (const key of [
    'bills',
    'bill',
    'tables',
    'tips',
    'overview',
    'payments',
    'payments-report',
  ]) {
    void queryClient.invalidateQueries({ queryKey: [key] });
  }
}
