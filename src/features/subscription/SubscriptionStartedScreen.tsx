import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { ResultBadge } from '@/components/ui/ResultBadge';
import { Text } from '@/components/ui/Text';
import { formatAmount, formatDay } from '@/lib/format';
import { useSession } from '@/store/session';

export default function SubscriptionStartedScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const subscription = useSession((s) => s.user?.subscription);

  if (!subscription) return <Redirect href="/subscription" />;

  const planName = t(`plans.${subscription.plan}`);
  const rows = [
    { label: t('subscription.plan'), value: planName },
    {
      label: t('subscription.length'),
      value: subscription.period === 'quarterly' ? t('subscription.threeMonths') : t('subscription.oneMonth'),
    },
    { label: t('subscription.price'), value: `${formatAmount(subscription.priceEtb)} ${t('common.etb')}` },
    { label: t('subscription.startedOn'), value: formatDay(subscription.startedAt) },
    { label: t('subscription.renewsOn'), value: formatDay(subscription.endsAt) },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center" accessibilityLiveRegion="assertive">
          <ResultBadge success />
          <Text font="heading" className="mt-5 text-center text-[26px]" accessibilityRole="header">
            {t('subscription.startedTitle')}
          </Text>
          <Text className="mt-2.5 max-w-[300px] text-center text-base leading-6 text-navInactive">
            {t('subscription.startedBody', { plan: planName })}
          </Text>
        </View>

        <View className="mt-8 rounded-[20px] border border-border bg-surface px-5 py-1">
          {rows.map((row, i) => (
            <View
              key={row.label}
              accessible
              className={`flex-row items-center justify-between gap-4 py-4 ${i < rows.length - 1 ? 'border-b border-divider' : ''}`}
            >
              <Text className="text-sm text-navInactive">{row.label}</Text>
              <Text font="semibold" className="flex-1 text-right text-[15px]">
                {row.value}
              </Text>
            </View>
          ))}
        </View>

        <View className="min-h-6 flex-1" />

        <Button label={t('subscription.goHome')} variant="success" onPress={() => router.dismissTo('/home')} />
      </ScrollView>
    </SafeAreaView>
  );
}
