import { onlineManager } from '@tanstack/react-query';
import { WifiOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isNetworkError } from '@/lib/errors';
import { queryClient } from '@/lib/queryClient';
import { colors } from '@/theme/tokens';

import { Text } from './Text';

/** A blip shorter than this does not show the banner (phones report short drops). */
const OFFLINE_AFTER_MS = 1500;

/**
 * Small banner while there is no connection (phone offline, or our server not answering).
 * Screens keep showing their saved data under it; only a screen with no data at all shows the
 * full "No connection" page.
 */
export function OfflineBanner() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);
  const [requestFailed, setRequestFailed] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = (isOnline: boolean) => {
      clearTimeout(timer);
      if (isOnline) setOffline(false);
      else timer = setTimeout(() => setOffline(true), OFFLINE_AFTER_MS);
    };
    update(onlineManager.isOnline());
    const unsubscribe = onlineManager.subscribe(update);
    // Failed requests count too: the phone may say "online" while nothing gets through.
    const unwatch = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated') return;
      if (event.action.type === 'error') {
        if (isNetworkError(event.action.error)) setRequestFailed(true);
      } else if (event.action.type === 'success') setRequestFailed(false);
    });
    return () => {
      unsubscribe();
      unwatch();
      clearTimeout(timer);
    };
  }, []);

  if (!offline && !requestFailed) return null;
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: insets.top + 6, left: 16, right: 16 }}
      className="items-center"
      accessibilityLiveRegion="polite"
    >
      <View className="flex-row items-center gap-2 rounded-full bg-dangerBg px-4 py-2">
        <WifiOff size={16} color={colors.dangerFg} strokeWidth={2.4} />
        <Text font="semibold" className="text-sm" style={{ color: colors.dangerFg }}>
          {t('errors.offlineBanner')}
        </Text>
      </View>
    </View>
  );
}
