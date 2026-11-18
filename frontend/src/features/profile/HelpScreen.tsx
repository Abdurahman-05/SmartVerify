import { useRouter } from 'expo-router';
import { LifeBuoy, Phone, Send } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBrandColors } from '@/store/theme';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { callSupport, SUPPORT, telegramSupport } from '@/lib/support';
import { GlassCard, PrimaryButton, ScreenBg, SecondaryButton } from '@/ui/glass';

export default function HelpScreen() {
  const brand = useBrandColors();
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <ScreenBg>
      <SafeAreaView className="flex-1">
        <ScreenHeader
          title={t('help.title')}
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
        />
        <GlassCard className="mx-4 mt-2 gap-3 p-4">
          <View className="h-12 w-12 items-center justify-center rounded-[14px] bg-primaryTile">
            <LifeBuoy size={26} color={brand.primary} strokeWidth={2.2} />
          </View>
          <Text font="heading" className="text-xl" accessibilityRole="header">
            {t('help.contactTitle')}
          </Text>
          <Text tone="muted" className="text-base leading-6">
            {t('help.contactBody')}
          </Text>
          <PrimaryButton
            label={t('help.call', { phone: SUPPORT.phone })}
            icon={Phone}
            onPress={callSupport}
          />
          <SecondaryButton label={t('help.telegram')} icon={Send} onPress={telegramSupport} />
        </GlassCard>
      </SafeAreaView>
    </ScreenBg>
  );
}
