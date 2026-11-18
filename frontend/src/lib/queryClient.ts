import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { AppState, Platform } from 'react-native';

import { isNetworkError } from '@/lib/errors';
import { useSession } from '@/store/session';

// Back online: React Query refetches what is on screen by itself.
// A phone does not tell it about the network on its own, expo-network does.
if (Platform.OS !== 'web') {
  onlineManager.setEventListener((setOnline) => {
    const apply = (state: Network.NetworkState) =>
      setOnline(state.isConnected === true && state.isInternetReachable !== false);
    // The listener only reports changes: start from the real state, so that going from offline
    // (e.g. the app opened without internet) to online is seen and everything is fetched again.
    void Network.getNetworkStateAsync()
      .then(apply)
      .catch(() => undefined);
    const sub = Network.addNetworkStateListener(apply);
    return () => sub.remove();
  });
  // Back to the app (from another app or the lock screen): fresh data too.
  focusManager.setEventListener((setFocused) => {
    const sub = AppState.addEventListener('change', (state) => setFocused(state === 'active'));
    return () => sub.remove();
  });
}

/**
 * The app's one React Query client (also used outside components, e.g. after a payment).
 * Loaded data stays for a day: screens show it at once and refresh in the background.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    // offlineFirst: without internet a list tries once and shows "No connection" (or its saved
    // data) instead of loading forever; it loads again by itself when the internet is back.
    queries: {
      gcTime: 24 * 60 * 60 * 1000,
      staleTime: 30 * 1000,
      // No internet: fail at once (the screen shows its saved data or "No connection") instead of
      // waiting for a retry that is paused while offline. Other errors retry once.
      retry: (count, error) => !isNetworkError(error) && count < 1,
      networkMode: 'offlineFirst',
    },
    // An action (pay, order, save) without internet fails at once with "No connection" instead
    // of waiting silently; the person sees it and tries again (the Idempotency-Key makes it safe).
    // Writes are never retried by themselves: the person taps again.
    mutations: { networkMode: 'always', retry: false },
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
