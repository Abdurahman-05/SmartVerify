import { onlineManager } from '@tanstack/react-query';
import { Wifi, WifiOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBrandColors } from '@/store/theme';
import { colors } from '@/theme/tokens';

import { Text } from './Text';

/** How long "Back online" stays after the internet returns. */
const BACK_MS = 2500;
/** A blip shorter than this does not cover the app (phones report short drops). */
const OFFLINE_AFTER_MS = 1500;

/**
 * The app works only online: without internet a full screen covers everything, so nobody taps
 * "send" and waits for something that never left the phone. It goes away by itself when the
 * internet is back, with a short "Back online".
 */
export function OfflineBanner() {
  const { t } = useTranslation();
  const brand = useBrandColors();
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);
  const [showBack, setShowBack] = useState(false);

  useEffect(() => {
    let wasOffline = false;
    let coverTimer: ReturnType<typeof setTimeout> | undefined;
    let backTimer: ReturnType<typeof setTimeout> | undefined;
    const update = (isOnline: boolean) => {
      clearTimeout(coverTimer);
      clearTimeout(backTimer);
      if (!isOnline) {
        setShowBack(false);
        coverTimer = setTimeout(() => {
          wasOffline = true;
          setOffline(true);
        }, OFFLINE_AFTER_MS);
        return;
      }
      setOffline(false);
      if (!wasOffline) return;
      wasOffline = false;
      setShowBack(true);
      backTimer = setTimeout(() => setShowBack(false), BACK_MS);
    };
    if (!onlineManager.isOnline()) update(false);
    const unsubscribe = onlineManager.subscribe(update);
    return () => {
      unsubscribe();
      clearTimeout(coverTimer);
      clearTimeout(backTimer);
    };
  }, []);

  if (offline) {
    return (
      <View
        // Covers and blocks the whole app while offline.
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        className="items-center justify-center gap-4 bg-background px-8"
        accessibilityViewIsModal
        accessibilityLiveRegion="assertive"
      >
        <View className="h-24 w-24 items-center justify-center rounded-[28px] bg-dangerBg">
          <WifiOff size={48} color={colors.dangerFg} strokeWidth={2} />
        </View>
        <Text font="heading" className="text-center text-[26px]" accessibilityRole="header">
          {t('errors.offlineTitle')}
        </Text>
        <Text tone="muted" className="text-center text-lg">
          {t('errors.offlineBody')}
        </Text>
        <View className="mt-2 flex-row items-center gap-2">
          <ActivityIndicator color={brand.primary} />
          <Text tone="muted" className="text-[15px]">
            {t('errors.offlineWaiting')}
          </Text>
        </View>
      </View>
    );
  }

  if (!showBack) return null;
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: insets.top + 6, left: 16, right: 16 }}
      className="items-center"
      accessibilityLiveRegion="polite"
    >
      <View className="flex-row items-center gap-2 rounded-full bg-primary px-4 py-2.5">
        <Wifi size={18} color={colors.surface} strokeWidth={2.4} />
        <Text font="semibold" tone="inverse" className="text-[15px]">
          {t('errors.backOnline')}
        </Text>
      </View>
    </View>
  );
}
