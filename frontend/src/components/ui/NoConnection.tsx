import { RefreshCw, WifiOff } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useOnline } from '@/hooks/useOnline';
import { useBrandColors } from '@/store/theme';

import { Button } from './Button';
import { Text } from './Text';

/**
 * A screen could not load (no internet, or the server not answering): a pop-up says so and the
 * app goes back to the previous page. With no previous page (the first screen, Home) or
 * `fullPage`, it stays as a full "No connection" page with Retry.
 */
export function NoConnection({
  onRetry,
  fullPage = false,
}: {
  onRetry: () => void;
  fullPage?: boolean;
}) {
  const brand = useBrandColors();
  const { t } = useTranslation();
  const online = useOnline();
  const router = useRouter();
  // Decided once, when the error shows: leave with a pop-up, or stay as a page.
  const [leave] = useState(() => !fullPage && router.canGoBack());
  const shown = useRef(false);

  useEffect(() => {
    if (!leave || shown.current) return;
    shown.current = true;
    Alert.alert(
      t(online ? 'errors.serverDownTitle' : 'errors.noConnectionTitle'),
      t(online ? 'errors.serverDown' : 'errors.noConnection')
    );
    router.back();
  }, [leave, online, router, t]);

  // Leaving: an empty page for the moment before the previous one is back.
  if (leave) return <View className="flex-1 bg-background" />;
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View
        className="flex-1 items-center justify-center gap-4 px-6"
        accessibilityLiveRegion="polite"
      >
        <View className="h-24 w-24 items-center justify-center rounded-[28px] bg-primaryTile">
          <WifiOff size={48} color={brand.primary} strokeWidth={2} />
        </View>
        <Text font="heading" className="text-center text-[26px]" accessibilityRole="header">
          {t(online ? 'errors.serverDownTitle' : 'errors.noConnectionTitle')}
        </Text>
        <Text tone="muted" className="text-center text-lg">
          {t(online ? 'errors.serverDownBody' : 'errors.noConnectionBody')}
        </Text>
      </View>
      <View className="px-4 pb-7">
        <Button label={t('errors.retry')} icon={RefreshCw} onPress={onRetry} />
      </View>
    </SafeAreaView>
  );
}
