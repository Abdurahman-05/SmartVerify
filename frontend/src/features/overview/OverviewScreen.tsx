import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ChartLine,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleDollarSign,
  Clock,
  ReceiptText,
  RefreshCw,
  Truck,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { GlassCard } from '@/components/ui/GlassCard';
import { HeroCard, HeroChip } from '@/components/ui/HeroCard';
import { IconTile } from '@/components/ui/IconTile';
import { LoadingView } from '@/components/ui/LoadingView';
import { MoneyText } from '@/components/ui/MoneyText';
import { NoConnection } from '@/components/ui/NoConnection';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { Segmented } from '@/components/ui/Segmented';
import { Text } from '@/components/ui/Text';
import { TopBar } from '@/components/ui/TopBar';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { getSpendings, spendingsKey } from '@/lib/extras';
import { getOverview, overviewKey } from '@/lib/overview';
import { periods, type Period } from '@/lib/period';
import { useFeatures } from '@/store/features';
import { useSession } from '@/store/session';
import { colors } from '@/theme/tokens';

// Design: docs/design/owner/screens/03-overview.png
const CASH_YELLOW = '#FDE047';
const DONUT = 96;
const DONUT_STROKE = 14;

/** Cash (yellow) against bank (white) as one ring, with the bank share in the middle. */
function CashBankDonut({ cashEtb, bankEtb }: { cashEtb: number; bankEtb: number }) {
  const { t } = useTranslation();
  const total = cashEtb + bankEtb;
  const bankPct = total > 0 ? Math.round((bankEtb / total) * 100) : 0;
  const r = (DONUT - DONUT_STROKE) / 2;
  const length = 2 * Math.PI * r;
  const cashPart = total > 0 ? (cashEtb / total) * length : 0;
  return (
    <View
      style={{ width: DONUT, height: DONUT }}
      accessible
      accessibilityLabel={`${bankPct}% ${t('overview.bankShare')}`}
    >
      <Svg width={DONUT} height={DONUT} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={DONUT / 2}
          cy={DONUT / 2}
          r={r}
          stroke={total > 0 ? '#FFFFFF' : 'rgba(255,255,255,0.3)'}
          strokeWidth={DONUT_STROKE}
          fill="none"
        />
        {cashPart > 0 ? (
          <Circle
            cx={DONUT / 2}
            cy={DONUT / 2}
            r={r}
            stroke={CASH_YELLOW}
            strokeWidth={DONUT_STROKE}
            strokeDasharray={`${cashPart} ${length}`}
            fill="none"
          />
        ) : null}
      </Svg>
      <View className="absolute inset-0 items-center justify-center">
        <Text font="heading" tone="inverse" className="text-base leading-5">
          {bankPct}%
        </Text>
        <Text tone="inverse" className="text-[11px] opacity-90">
          {t('overview.bankShare')}
        </Text>
      </View>
    </View>
  );
}

/** Small glass card: icon tile, big number, label. */
function StatCard({
  icon,
  tone,
  value,
  label,
}: {
  icon: LucideIcon;
  tone?: 'amber';
  value: number | null;
  label: string;
}) {
  return (
    <GlassCard containerStyle={{ flex: 1 }} style={{ padding: 12, gap: 6 }}>
      <IconTile icon={icon} tone={tone ?? 'brand'} size={36} radius={12} iconSize={18} />
      {value === null ? (
        <Text font="heading" className="text-xl">
          —
        </Text>
      ) : (
        <MoneyText value={value} showCurrency={false} font="heading" className="text-xl" />
      )}
      <Text className="text-[13px]" style={{ color: colors.muted }} numberOfLines={2}>
        {label}
      </Text>
    </GlassCard>
  );
}

/** One "Needs your attention" card: tile, title + note, chevron. */
function AttentionRow({
  icon,
  tone,
  title,
  subtitle,
  onPress,
}: {
  icon: LucideIcon;
  tone: 'red' | 'amber';
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <GlassCard
      onPress={onPress}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}
    >
      <IconTile icon={icon} tone={tone} />
      <View className="min-w-0 flex-1">
        <Text font="bold" className="text-[15px] leading-[19px]">
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-0.5 text-sm leading-[18px]" style={{ color: colors.muted }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={18} color="#8A8085" strokeWidth={2.2} />
    </GlassCard>
  );
}

/** Owner / manager overview. */
export default function OverviewScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useSession((s) => s.user);
  const [period, setPeriod] = useState<Period>('today');

  const query = useQuery({ queryKey: overviewKey(period), queryFn: () => getOverview(period) });
  const { refetch } = query;
  // Owner, Money out on: what was spent today. Nothing is shown (or asked) while it is off.
  const moneyOut = useFeatures((s) => s.featureMoneyOut);
  const showSpent = user?.role === 'owner' && moneyOut;
  const spent = useQuery({ queryKey: spendingsKey, queryFn: getSpendings, enabled: showSpent });
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/home'));

  if (query.isPending) return <LoadingView screenTitle={t('overview.title')} onBack={goBack} />;
  if (query.isError && !query.data && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void refetch()} />;
  }

  const data = query.data;
  const latestFee = data?.deliveryFeeChanges.latest[0];
  const showOpen = !!data && (data.openTables > 0 || data.openBills > 0);
  const showFee = !!data && data.deliveryFeeChanges.count > 0 && !!latestFee;
  const attentionCount = (showOpen ? 1 : 0) + (showFee ? 1 : 0);

  return (
    <ScreenBackground>
      <SafeAreaView className="flex-1">
        <View className="px-4 pb-3 pt-2">
          <TopBar
            title={t('overview.title')}
            subtitle={user ? `${user.businessName} · ${t(`roles.${user.role}`)}` : undefined}
            left={{ icon: ChevronLeft, onPress: goBack, label: t('common.back') }}
          />
        </View>

        <View className="px-4 pb-3">
          <Segmented
            options={periods.map((p) => ({ value: p, label: t(`period.${p}`) }))}
            value={period}
            onChange={setPeriod}
          />
        </View>

        {!data ? (
          <View className="flex-1 items-center justify-center gap-4 px-6">
            <Text font="semibold" className="text-center text-lg">
              {t('overview.loadFailed')} {t(errorMessageKey(query.error))}
            </Text>
            <View className="w-full">
              <PrimaryButton
                label={t('errors.retry')}
                icon={RefreshCw}
                onPress={() => void refetch()}
              />
            </View>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}>
            <HeroCard>
              <View className="flex-row items-center gap-3">
                <View className="flex-1" accessible>
                  <Text font="bold" tone="inverse" className="text-[13px] uppercase opacity-90">
                    {t('overview.totalSales')}
                  </Text>
                  <Text
                    font="heading"
                    tone="inverse"
                    className="text-[34px] leading-[40px]"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    <MoneyText
                      value={data.salesEtb}
                      showCurrency={false}
                      tone="inverse"
                      font="heading"
                    />{' '}
                    <Text font="heading" tone="inverse" className="text-base">
                      {t('common.etb')}
                    </Text>
                  </Text>
                </View>
                <CashBankDonut cashEtb={data.cashEtb} bankEtb={data.bankEtb} />
              </View>
              <View className="mt-3.5 flex-row gap-2">
                {[
                  { label: t('overview.cash'), value: data.cashEtb, dot: CASH_YELLOW },
                  { label: t('overview.bank'), value: data.bankEtb, dot: '#FFFFFF' },
                ].map((part) => (
                  <HeroChip
                    key={part.label}
                    style={{ flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center' }}
                  >
                    <View
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: part.dot }}
                    />
                    <View className="flex-1" accessible>
                      <Text tone="inverse" className="text-[13px] opacity-90">
                        {part.label}
                      </Text>
                      <MoneyText
                        value={part.value}
                        showCurrency={false}
                        tone="inverse"
                        font="heading"
                        className="text-lg"
                      />
                    </View>
                  </HeroChip>
                ))}
              </View>
            </HeroCard>

            <View className="flex-row gap-2">
              <StatCard icon={ReceiptText} value={data.orders} label={t('overview.ordersLabel')} />
              <StatCard
                icon={ChartLine}
                value={data.paidBills > 0 ? Math.round(data.salesEtb / data.paidBills) : null}
                label={t('overview.avgBill')}
              />
              <StatCard
                icon={CircleDollarSign}
                tone="amber"
                value={data.tipsEtb}
                label={t('overview.tipsNotSales')}
              />
            </View>

            {showSpent && spent.data ? (
              <GlassCard
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}
              >
                <IconTile icon={Wallet} />
                <Text font="bold" className="flex-1 text-[15px]">
                  {t('extras.money.spentToday')}
                </Text>
                <MoneyText
                  value={spent.data.totals.today}
                  showCurrency={false}
                  font="heading"
                  className="text-lg"
                />
              </GlassCard>
            ) : null}

            <View className="mt-1 flex-row items-center justify-between">
              <Text font="bold" className="flex-1 text-base" accessibilityRole="header">
                {t('overview.attention')}
              </Text>
              {attentionCount > 0 ? (
                <View
                  className="h-7 justify-center rounded-[14px] px-2.5"
                  style={{ backgroundColor: colors.dangerBg }}
                >
                  <Text font="bold" className="text-[13px]" style={{ color: colors.dangerFg }}>
                    {t('overview.newCount', { count: attentionCount })}
                  </Text>
                </View>
              ) : null}
            </View>

            {attentionCount === 0 ? (
              <GlassCard
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14 }}
              >
                <CircleCheck size={22} color={colors.successFg} strokeWidth={2.2} />
                <Text
                  font="bold"
                  className="flex-1 text-[15px]"
                  style={{ color: colors.successFg }}
                >
                  {t('overview.allGood')}
                </Text>
              </GlassCard>
            ) : null}
            {showOpen ? (
              <AttentionRow
                icon={data.openTables > 0 ? Clock : UtensilsCrossed}
                tone="red"
                title={
                  data.openTables > 0
                    ? t('overview.openTables', { count: data.openTables })
                    : t('overview.openBills', { count: data.openBills })
                }
                subtitle={t('overview.openBillsSub')}
                onPress={() => router.push('/bills')}
              />
            ) : null}
            {showFee && latestFee ? (
              <AttentionRow
                icon={Truck}
                tone="amber"
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
          </ScrollView>
        )}
      </SafeAreaView>
    </ScreenBackground>
  );
}
