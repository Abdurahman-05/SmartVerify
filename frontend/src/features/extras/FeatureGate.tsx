import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';

import { LoadingView } from '@/components/ui/LoadingView';
import { homeRouteFor, useSession } from '@/store/session';
import { useFeatures } from '@/store/features';

/**
 * Shows its screen only while the feature is on. An old link or stale state while it is off goes
 * back to Home. While the switches are still loading, it waits instead of guessing.
 */
export function FeatureGate({
  feature,
  children,
}: {
  feature: 'featureBuyList' | 'featureMoneyOut';
  children: ReactNode;
}) {
  const user = useSession((s) => s.user);
  const on = useFeatures((s) => s[feature]);
  const loaded = useFeatures((s) => s.loaded);

  if (!loaded) return <LoadingView />;
  if (!on) return <Redirect href={homeRouteFor(user)} />;
  return children;
}
