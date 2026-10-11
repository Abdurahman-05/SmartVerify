import { useRouter } from 'expo-router';
import { Crown, Users, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { useBrandColors } from '@/store/theme';

function HelpCard({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  const brand = useBrandColors();
  return (
    <View
      className="flex-row items-start gap-3 rounded-[20px] border-[1.5px] border-border bg-surface px-4 py-3.5"
      accessible
    >
      <View className="h-11 w-11 items-center justify-center rounded-[12px] bg-primaryTile">
        <Icon size={22} color={brand.primary} strokeWidth={2.2} />
      </View>
      <View className="min-w-0 flex-1 gap-1">
        <Text font="bold" className="text-[17px]">
          {title}
        </Text>
        <Text tone="muted" className="text-base leading-6">
          {body}
        </Text>
      </View>
    </View>
  );
}

/**
 * Forgot PIN. A self-service reset needs a code sent by SMS to prove the phone belongs to the
 * person; until that exists, this explains who can help.
 */
export default function ForgotPinScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/sign-in'));

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader
        title={t('pin.forgot.title')}
        subtitle={t('pin.forgot.subtitle')}
        onBack={goBack}
      />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, gap: 12, paddingHorizontal: 16, paddingTop: 4 }}
      >
        <HelpCard
          icon={Users}
          title={t('pin.forgot.staffTitle')}
          body={t('pin.forgot.staffBody')}
        />
        <HelpCard
          icon={Crown}
          title={t('pin.forgot.ownerTitle')}
          body={t('pin.forgot.ownerBody')}
        />
        <View className="min-h-6 flex-1" />
        <View className="pb-6">
          <Button label={t('pin.forgot.back')} onPress={goBack} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
