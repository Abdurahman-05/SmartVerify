import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import {
  getKitchenOrders,
  kitchenKey,
  KITCHEN_REFRESH_MS,
  markReady,
  startCooking,
} from '@/lib/kitchen';

/** Kitchen tickets from the server: refreshed on focus and every few seconds. */
export function useKitchenOrders() {
  const query = useQuery({
    queryKey: kitchenKey,
    queryFn: getKitchenOrders,
    refetchInterval: KITCHEN_REFRESH_MS,
  });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );
  return query;
}

/** Start cooking / mark ready, then refresh the tickets and the bills (served status). */
export function useKitchenActions() {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: kitchenKey });
    void queryClient.invalidateQueries({ queryKey: ['bills'] });
    void queryClient.invalidateQueries({ queryKey: ['bill'] });
  };
  const start = useMutation({ mutationFn: startCooking, onSettled: refresh });
  const ready = useMutation({ mutationFn: markReady, onSettled: refresh });
  const failed = start.isError ? start : ready.isError ? ready : null;
  return { start, ready, failed };
}
