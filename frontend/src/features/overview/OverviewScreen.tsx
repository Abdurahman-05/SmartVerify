import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Banknote,
  Bike,
  ChevronRight,
  CircleCheck,
  HandCoins,
  Landmark,
  RefreshCw,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { LoadingView } from '@/components/ui/LoadingView';
import { MoneyText } from '@/components/ui/MoneyText';
import { NoConnection } from '@/components/ui/NoConnection';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { Pill } from '@/features/orders/Pill';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { getOverview, overviewKey } from '@/lib/overview';
import { periods, type Period } from '@/lib/period';
import { useSession } from '@/store/session';
import { useBrandColors } from '@/store/theme';
import { colors } from '@/theme/tokens';

function SplitBox({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  const brand = useBrandColors();
  return (
    <View
      className="flex-1 gap-1 rounded-[18px] border-[1.5px] border-border bg-surface px-3 py-2.5"
      accessible
    >
      <View className="flex-row items-center gap-1.5">
        <Icon size={18} color={brand.primary} strokeWidth={2.2} />
        <Text font="bold" tone="muted" className="text-sm">
          {label}
        </Text>
      </View>
      <MoneyText value={value} font="bold" className="text-[17px]" />
    </View>
  );
}

function AttentionRow({
  icon: Icon,
  title,
  subtitle,
  onPress,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="min-h-16 flex-row items-center gap-3 rounded-[18px] border-[1.5px] border-border bg-surface px-3 py-2.5 active:bg-background"
    >
      <View className="h-11 w-11 items-center justify-center rounded-[12px] bg-warnBg">
        <Icon size={22} color={colors.warnFg} strokeWidth={2.2} />
      </View>
      <View className="min-w-0 flex-1">
        <Text font="bold" className="text-base">
          {title}
        </Text>
        {subtitle ? (
          <Text tone="muted" className="text-sm">
            {subtitle}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={22} color={colors.muted} strokeWidth={2.2} />
    </Pressable>
  );
}

/** Owner / manager overview (AdminOverview design). */
export default function OverviewScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useSession((s) => s.user);
  const [period, setPeriod] = useState<Period>('today');

  const query = useQuery({ queryKey: overviewKey(period), queryFn: () => getOverview(period) });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/home'));

  if (query.isPending) return <LoadingView screenTitle={t('overview.title')} onBack={goBack} />;
  if (query.isError && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void refetch()} />;
  }

  const data = query.data;
  const latestFee = data?.deliveryFeeChanges.latest[0];
  const nothingToDo = data && data.openBills === 0 && data.deliveryFeeChanges.count === 0;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader
        title={t('overview.title')}
        subtitle={user ? `${user.businessName} · ${t(`roles.${user.role}`)}` : undefined}
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

      {!data ? (
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text font="semibold" className="text-center text-lg">
            {t('overview.loadFailed')} {t(errorMessageKey(query.error))}
          </Text>
          <View className="w-full">
            <Button label={t('errors.retry')} icon={RefreshCw} onPress={() => void refetch()} />
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 10 }}>
          <View className="rounded-[20px] bg-primary px-[18px] py-4" accessible>
            <Text font="semibold" tone="inverse" className="text-sm opacity-90">
              {t('overview.totalSales')} · {t('overview.orders', { count: data.orders })}
            </Text>
            <MoneyText value={data.salesEtb} tone="inverse" className="mt-1 text-[34px]" />
          </View>

          <View className="flex-row gap-2">
            <SplitBox icon={Banknote} label={t('overview.cash')} value={data.cashEtb} />
            <SplitBox icon={Landmark} label={t('overview.bank')} value={data.bankEtb} />
            <SplitBox icon={HandCoins} label={t('overview.tips')} value={data.tipsEtb} />
          </View>
          <Text tone="muted" className="text-sm">
            {t('overview.tipsNote')}
          </Text>

          <Text font="heading" className="pt-2 text-lg" accessibilityRole="header">
            {t('overview.attention')}
          </Text>
          {nothingToDo ? (
            <View className="flex-row items-center gap-2 rounded-[16px] bg-successBg p-3">
              <CircleCheck size={22} color={colors.successFg} strokeWidth={2.2} />
              <Text font="bold" className="flex-1 text-base" style={{ color: colors.successFg }}>
                {t('overview.allGood')}
              </Text>
            </View>
          ) : null}
          {data.openTables > 0 ? (
            <AttentionRow
              icon={UtensilsCrossed}
              title={t('overview.openTables', { count: data.openTables })}
              subtitle={t('overview.openBillsSub')}
              onPress={() => router.push('/bills')}
            />
          ) : data.openBills > 0 ? (
            <AttentionRow
              icon={UtensilsCrossed}
              title={t('overview.openBills', { count: data.openBills })}
              subtitle={t('overview.openBillsSub')}
              onPress={() => router.push('/bills')}
            />
          ) : null}
          {data.deliveryFeeChanges.count > 0 && latestFee ? (
            <AttentionRow
              icon={Bike}
              title={t('overview.feeChanged', { count: data.deliveryFeeChanges.count })}
              subtitle={t('overview.feeChangedSub', {
                name: latestFee.changedBy,
                from: latestFee.usualFeeEtb,
                to: latestFee.feeEtb,
              })}
              onPress={() =>
                router.push({ pathname: '/bills/[id]', params: { id: latestFee.billId } })
              }
            />
          ) : null}
          <AttentionRow
            icon={HandCoins}
            title={t('overview.tipsToPay')}
            subtitle={t('overview.tipsToPaySub')}
            onPress={() => router.push('/tips-admin')}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
