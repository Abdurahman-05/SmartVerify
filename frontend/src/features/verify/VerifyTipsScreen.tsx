import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BankBadge } from '@/components/ui/BankBadge';
import { LoadingView } from '@/components/ui/LoadingView';
import { formatMoney, MoneyText } from '@/components/ui/MoneyText';
import { NoConnection } from '@/components/ui/NoConnection';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { Pill } from '@/features/orders/Pill';
import { isNetworkError } from '@/lib/errors';
import { formatDay, formatTime } from '@/lib/format';
import { periods, type Period } from '@/lib/period';
import { getVerifyTips, verifyTipsKey } from '@/lib/verification';
import { useSession } from '@/store/session';

/**
 * Normal plan in the Restaurant app: tips kept from customers who paid more. Waiters see their
 * own; the owner and managers see every waiter's, with a total per waiter.
 */
export default function VerifyTipsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const manages = useSession((s) => s.user?.role === 'owner' || s.user?.role === 'manager');
  const [period, setPeriod] = useState<Period>('today');
  const query = useQuery({ queryKey: verifyTipsKey(period), queryFn: () => getVerifyTips(period) });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/home'));
  if (query.isError && !query.data && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void refetch()} />;
  }
  if (!query.data) return <LoadingView screenTitle={t('verifyTips.title')} onBack={goBack} />;
  const data = query.data;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader
        title={t('verifyTips.title')}
        subtitle={t('verifyTips.subtitle')}
        onBack={goBack}
      />

      <View className="flex-row gap-2 px-4 pb-2.5" accessibilityRole="radiogroup">
        {periods.map((p) => (
          <Pill
            key={p}
            label={t(`period.${p}`)}
            selected={period === p}
            onPress={() => setPeriod(p)}
          />
        ))}
      </View>

      <View className="mx-4 mb-2.5 rounded-[20px] bg-primary px-[18px] py-3.5" accessible>
        <Text font="semibold" tone="inverse" className="text-sm opacity-90">
          {t('verifyTips.total')}
        </Text>
        <MoneyText value={data.totalEtb} tone="inverse" className="mt-1 text-[30px]" />
      </View>

      {manages && data.byWaiter.length > 0 ? (
        <View className="mx-4 mb-2.5 rounded-[18px] border-[1.5px] border-border bg-surface px-4 py-1">
          <Text font="bold" tone="muted" className="pt-2 text-sm">
            {t('verifyTips.byWaiter')}
          </Text>
          {data.byWaiter.map((w) => (
            <View key={w.name} className="flex-row items-center justify-between py-2" accessible>
              <Text font="semibold" className="flex-1 text-base">
                {w.name} · {w.count}
              </Text>
              <MoneyText value={w.totalEtb} font="bold" className="text-base" />
            </View>
          ))}
        </View>
      ) : null}

      <FlatList
        data={data.items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 24 }}
        ListEmptyComponent={
          <Text tone="muted" className="py-10 text-center text-base">
            {t('verifyTips.empty')}
          </Text>
        }
        renderItem={({ item }) => {
          const today = new Date(item.createdAt).toDateString() === new Date().toDateString();
          return (
            <View
              accessible
              className="flex-row items-center gap-3 rounded-[18px] border-[1.5px] border-border bg-surface px-3.5 py-3"
            >
              <BankBadge code={item.bankCode} size={40} />
              <View className="flex-1">
                <Text font="bold" className="text-base">
                  {manages
                    ? item.waiterName
                    : t('verifyTips.paid', { amount: formatMoney(item.amountEtb) })}
                </Text>
                <Text tone="muted" className="text-sm">
                  {manages
                    ? `${t('verifyTips.paid', { amount: formatMoney(item.amountEtb) })} · `
                    : ''}
                  {today ? formatTime(item.createdAt) : formatDay(item.createdAt, false)}
                </Text>
              </View>
              <MoneyText value={item.tipEtb} font="bold" className="text-lg text-success" />
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
