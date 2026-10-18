import { QueryClient } from '@tanstack/react-query';

/**
 * The app's one React Query client (also used outside components, e.g. after a payment).
 * Loaded data stays for a day: screens show it at once and refresh in the background.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { gcTime: 24 * 60 * 60 * 1000, staleTime: 30 * 1000, retry: 1 },
  },
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
