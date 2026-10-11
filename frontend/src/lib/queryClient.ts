import { QueryClient } from '@tanstack/react-query';

/** The app's one React Query client (also used outside components, e.g. after a payment). */
export const queryClient = new QueryClient();

/** Everything that changes when a bill is paid. */
export function refreshAfterPayment() {
  for (const key of ['bills', 'bill', 'tables', 'tips', 'overview']) {
    void queryClient.invalidateQueries({ queryKey: [key] });
  }
}
