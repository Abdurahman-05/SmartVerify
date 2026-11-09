import { onlineManager } from '@tanstack/react-query';
import { Wifi, WifiOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useOnline } from '@/hooks/useOnline';
import { colors } from '@/theme/tokens';

import { Text } from './Text';

/** How long "Back online" stays after the internet returns. */
const BACK_MS = 2500;

/**
 * Over every screen: "No internet" while Wi-Fi and mobile data are off, then "Back online" for a
 * moment. Taps pass through it, so nothing under it is blocked.
 */
export function OfflineBanner() {
  const { t } = useTranslation();
  const online = useOnline();
  const insets = useSafeAreaInsets();
  const [showBack, setShowBack] = useState(false);

  // "Back online" only after being offline: follow the changes as they come.
  useEffect(() => {
    let wasOffline = !onlineManager.isOnline();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = onlineManager.subscribe((isOnline) => {
      clearTimeout(timer);
      if (!isOnline) {
        wasOffline = true;
        setShowBack(false);
        return;
      }
      if (!wasOffline) return;
      wasOffline = false;
      setShowBack(true);
      timer = setTimeout(() => setShowBack(false), BACK_MS);
    });
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  if (online && !showBack) return null;
  const Icon = online ? Wifi : WifiOff;
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: insets.top + 6, left: 16, right: 16 }}
      className="items-center"
      accessibilityLiveRegion="polite"
    >
      <View
        className={`flex-row items-center gap-2 rounded-full px-4 py-2.5 ${
          online ? 'bg-primary' : 'bg-dangerFg'
        }`}
      >
        <Icon size={18} color={colors.surface} strokeWidth={2.4} />
        <Text font="semibold" tone="inverse" className="text-[15px]">
          {t(online ? 'errors.backOnline' : 'errors.offlineBanner')}
        </Text>
      </View>
    </View>
  );
}
