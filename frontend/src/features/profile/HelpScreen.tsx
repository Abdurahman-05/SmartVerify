import { useRouter } from 'expo-router';
import { LifeBuoy } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBrandColors } from '@/store/theme';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';

export default function HelpScreen() {
  const brand = useBrandColors();
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader
        title={t('help.title')}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
      />
      {/* TODO: add real support contact details (phone, Telegram) once they are decided. */}
      <View className="mx-4 mt-2 gap-3 rounded-card border-[1.5px] border-border bg-surface p-4">
        <View className="h-12 w-12 items-center justify-center rounded-[14px] bg-primaryTile">
          <LifeBuoy size={26} color={brand.primary} strokeWidth={2.2} />
        </View>
        <Text font="heading" className="text-xl" accessibilityRole="header">
          {t('help.contactTitle')}
        </Text>
        <Text tone="muted" className="text-base leading-6">
          {t('help.contactBody')}
        </Text>
      </View>
    </SafeAreaView>
  );
}
