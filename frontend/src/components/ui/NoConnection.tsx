import { RefreshCw, WifiOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useOnline } from '@/hooks/useOnline';
import { useBrandColors } from '@/store/theme';

import { Button } from './Button';
import { Text } from './Text';

/** Full-screen "No connection" state with Retry (or "server not answering" when online). */
export function NoConnection({ onRetry }: { onRetry: () => void }) {
  const brand = useBrandColors();
  const { t } = useTranslation();
  const online = useOnline();
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
