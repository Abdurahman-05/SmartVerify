import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

import { getPaymentInfo, USE_MOCK_SUBSCRIPTION } from '@/lib/subscription';
import { isNormalApp } from '@/lib/variant';

import { normalMultiMonthlyEtb, normalPricing, restaurantMonthlyEtb } from './plans';

/** Prices the plan screens show. */
export interface PlanPrices {
  /** The plain plan this app sells (Normal in the Shop app, Normal Verify in the Restaurant app). */
  normal: { monthly: number; quarterly: number };
  normalMulti: number;
  restaurant: number;
  /** What 3 months saves against paying month by month. */
  quarterlySaving: number;
}

const savingOf = (p: { monthly: number; quarterly: number }) => p.monthly * 3 - p.quarterly;

/** Offline mock (and anyone who cannot read the server's prices): the numbers in plans.ts. */
const fallback: PlanPrices = {
  normal: {
    monthly: normalPricing.monthly.priceEtb,
    quarterly: normalPricing.quarterly.priceEtb,
  },
  normalMulti: normalMultiMonthlyEtb,
  restaurant: restaurantMonthlyEtb,
  quarterlySaving: savingOf({
    monthly: normalPricing.monthly.priceEtb,
    quarterly: normalPricing.quarterly.priceEtb,
  }),
};

/**
 * Plan prices from the server (the same call the pay screen uses; owner only), refetched each
 * time the screen is focused so a price the admin changed shows right away. With the mock on, or
 * `enabled` false (staff cannot read it), the plans.ts numbers are used and nothing loads.
 */
export function usePlanPrices(enabled = true) {
  const useServer = enabled && !USE_MOCK_SUBSCRIPTION;
  const query = useQuery({
    queryKey: ['subscription-payment-info'],
    queryFn: getPaymentInfo,
    enabled: useServer,
  });
  const { refetch } = query;

  // The first focus is the mount fetch above; later focuses (coming back) fetch again.
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      if (useServer) void refetch();
    }, [useServer, refetch])
  );

  let prices: PlanPrices | null = fallback;
  if (useServer) {
    const p = query.data?.prices;
    if (p) {
      const normal = isNormalApp ? p.normal : (p.restaurant_normal ?? fallback.normal);
      prices = {
        normal,
        normalMulti: p.normal_multi?.monthly ?? fallback.normalMulti,
        restaurant: p.restaurant.monthly,
        quarterlySaving: savingOf(normal),
      };
    } else {
      prices = null;
    }
  }

  return {
    prices,
    isPending: useServer && query.isPending,
    isError: useServer && query.isError && !query.data,
    error: query.error,
    refetch,
  };
}
