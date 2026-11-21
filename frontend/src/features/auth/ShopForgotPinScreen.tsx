import { useRouter } from 'expo-router';
import { MessageCircle, Phone } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { callSupport, telegramSupport } from '@/lib/support';
import { GlassCard, PrimaryButton, ScreenBg } from '@/ui/glass';

/**
 * Shop app Forgot PIN: shop owners have no email, so there is nothing to send a code to.
 * They contact support, who reset the PIN. TODO: reset with an SMS code to the phone.
 */
export default function ShopForgotPinScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/sign-in'));

  return (
    <ScreenBg>
      <SafeAreaView className="flex-1">
        <ScreenHeader title={t('pin.forgot.title')} onBack={goBack} />
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, gap: 12, paddingHorizontal: 16, paddingTop: 4 }}
        >
          <GlassCard className="px-4 py-4">
            <Text className="text-[17px] leading-7">{t('pin.forgot.shopBody')}</Text>
          </GlassCard>
          <PrimaryButton label={t('pin.forgot.shopCall')} icon={Phone} onPress={callSupport} />
          <PrimaryButton
            label={t('pin.forgot.shopTelegram')}
            icon={MessageCircle}
            onPress={telegramSupport}
          />
          <View className="min-h-6 flex-1" />
          <View className="pb-6">
            <PrimaryButton label={t('pin.forgot.back')} onPress={goBack} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </ScreenBg>
  );
}
