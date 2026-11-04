import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { Banknote, ChevronRight, Landmark, type LucideIcon } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { LoadingView } from '@/components/ui/LoadingView';
import { formatMoney, MoneyText } from '@/components/ui/MoneyText';
import { NoConnection } from '@/components/ui/NoConnection';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { CalendarButton } from '@/features/transactions/CalendarButton';
import { CalendarSheet } from '@/features/transactions/CalendarSheet';
import { ApiError } from '@/lib/api/client';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { getMoneyFlow, moneyFlowKey, type ExpenseRange, type MoneySplit } from '@/lib/extras';
import { periods } from '@/lib/period';
import { useBrandColors } from '@/store/theme';
import { colors } from '@/theme/tokens';

import { FeatureGate } from './FeatureGate';

/** Cash in drawer or Bank: what came in, what went out, and what is left (big). */
function SideCard({
  icon: Icon,
  label,
  sales,
  out,
  left,
}: {
  icon: LucideIcon;
  label: string;
  sales: number;
  out: number;
  left: number;
}) {
  const { t } = useTranslation();
  const brand = useBrandColors();
  return (
    <View
      className="flex-1 rounded-[20px] border-[1.5px] border-border bg-surface px-3.5 py-3"
      accessible
    >
      <View className="flex-row items-center gap-2">
        <View className="h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-primarySoft">
          <Icon size={20} color={brand.primary} strokeWidth={2.2} />
        </View>
        <Text font="bold" className="flex-1 text-[15px]" numberOfLines={2}>
          {label}
        </Text>
      </View>
      <MoneyText
        value={left}
        className={`mt-2 text-2xl ${left < 0 ? 'text-alert' : ''}`}
        numberOfLines={1}
        adjustsFontSizeToFit
      />
      <Text tone="muted" className="mt-0.5 text-sm" numberOfLines={2}>
        {t('extras.flow.inOut', { in: formatMoney(sales, false), out: formatMoney(out, false) })}
      </Text>
    </View>
  );
}

/** One line of the profit card; strong lines are results (a line above them). */
function FlowLine({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <View
      className={`flex-row items-center justify-between py-1 ${
        strong ? 'mt-0.5 border-t border-divider pt-1.5' : ''
      }`}
    >
      <Text font={strong ? 'bold' : undefined} className="text-[15px]">
        {label}
      </Text>
      <Text
        font={strong ? 'bold' : 'semibold'}
        className={`text-[15px] ${strong && value < 0 ? 'text-alert' : ''}`}
      >
        {value < 0 ? '− ' : ''}
        {formatMoney(Math.abs(value))}
      </Text>
    </View>
  );
}

function Flow() {
  const { t } = useTranslation();
  const router = useRouter();
  const [range, setRange] = useState<ExpenseRange>({ period: 'today' });
  const [choosing, setChoosing] = useState(false);

  const query = useQuery({ queryKey: moneyFlowKey(range), queryFn: () => getMoneyFlow(range) });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  if (query.isPending) return <LoadingView screenTitle={t('extras.flow.title')} />;
  if (query.isError && !query.data && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void refetch()} />;
  }

  const dayDate = range.day ? new Date(`${range.day}T12:00:00`) : null;
  const rangeLabel = dayDate
    ? t('period.day', { month: t(`period.month_${dayDate.getMonth()}`), day: dayDate.getDate() })
    : t(`period.${range.period}`);
  const flow = query.data;
  const forbidden = query.error instanceof ApiError && query.error.code === 'FORBIDDEN';
  const zero: MoneySplit = { total: 0, cash: 0, bank: 0 };
  const sales = flow?.sales ?? zero;
  const out = flow?.expenses ?? zero;
  const left = flow?.left ?? zero;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScreenHeader
        title={t('extras.flow.title')}
        onBack={() => router.back()}
        right={<CalendarButton day={dayDate} onPress={() => setChoosing(true)} />}
      />
      <View className="flex-row gap-2 px-4 pb-2.5">
        {periods.map((p) => {
          const selected = !range.day && range.period === p;
          return (
            <Pressable
              key={p}
              onPress={() => setRange({ period: p })}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              className={`h-12 items-center justify-center rounded-3xl px-[18px] ${
                selected ? 'bg-primary' : 'border-2 border-borderStrong bg-surface'
              }`}
            >
              <Text font="bold" tone={selected ? 'inverse' : 'default'} className="text-base">
                {t(`period.${p}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {!flow ? (
        <Text tone="muted" className="px-6 pt-6 text-center text-lg">
          {forbidden ? t('extras.flow.notAllowed') : t(errorMessageKey(query.error))}
        </Text>
      ) : (
        <ScrollView contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingBottom: 16 }}>
          <View className="rounded-card bg-primary px-5 py-4" accessible>
            <Text font="semibold" tone="inverse" className="text-[15px] opacity-90">
              {t('extras.flow.left')} · {rangeLabel}
            </Text>
            <MoneyText
              value={left.total}
              tone="inverse"
              className="mt-0.5 text-[38px]"
              numberOfLines={1}
              adjustsFontSizeToFit
              style={left.total < 0 ? { color: colors.tipOnDark } : undefined}
            />
            <View className="mt-2.5 flex-row gap-2.5">
              <View className="flex-1 rounded-[14px] bg-white/10 px-3 py-2">
                <Text tone="inverse" className="text-sm opacity-90">
                  {t('extras.flow.sales')}
                </Text>
                <MoneyText value={sales.total} tone="inverse" font="bold" className="text-lg" />
              </View>
              <View className="flex-1 rounded-[14px] bg-white/10 px-3 py-2">
                <Text tone="inverse" className="text-sm opacity-90">
                  {t('extras.flow.expenses')}
                </Text>
                <MoneyText value={out.total} tone="inverse" font="bold" className="text-lg" />
              </View>
            </View>
          </View>

          <View className="flex-row gap-2.5">
            <SideCard
              icon={Banknote}
              label={t('extras.flow.cashInDrawer')}
              sales={sales.cash}
              out={out.cash}
              left={left.cash}
            />
            <SideCard
              icon={Landmark}
              label={t('extras.flow.bank')}
              sales={sales.bank}
              out={out.bank}
              left={left.bank}
            />
          </View>

          <View
            className="rounded-[20px] border-[1.5px] border-border bg-surface px-3.5 py-3"
            accessible
          >
            <Text font="bold" className="pb-1.5 text-base" accessibilityRole="header">
              {t('extras.flow.profitTitle')}
            </Text>
            <FlowLine label={t('extras.flow.sales')} value={sales.total} />
            <FlowLine label={t('extras.flow.costs')} value={-flow.costs.total} />
            <FlowLine label={t('extras.flow.profit')} value={flow.profit} strong />
            <FlowLine label={t('extras.flow.other')} value={-flow.other.total} />
            <FlowLine label={t('extras.flow.moneyLeft')} value={left.total} strong />
          </View>

          {flow.newCount > 0 ? (
            <Pressable
              onPress={() => router.push('/money-out')}
              accessibilityRole="button"
              className="min-h-12 flex-row items-center gap-2.5 rounded-[18px] border-[1.5px] border-amber bg-tipBg px-3.5 py-2.5 active:opacity-80"
            >
              <View className="h-2.5 w-2.5 rounded-full bg-amber" />
              <Text font="bold" className="flex-1 text-[15px] text-warnFg">
                {t('extras.flow.newFromStaff', { count: flow.newCount })}
              </Text>
              <ChevronRight size={22} color={colors.warnFg} strokeWidth={2.2} />
            </Pressable>
          ) : null}

          <View className="rounded-[20px] border-[1.5px] border-border bg-surface px-3.5 py-3">
            <Text font="bold" className="pb-2 text-base" accessibilityRole="header">
              {t('extras.flow.whereWent')}
            </Text>
            {flow.byCategory.length === 0 ? (
              <Text tone="muted" className="text-sm">
                {t('extras.flow.noExpenses')}
              </Text>
            ) : (
              <View className="gap-2.5">
                {flow.byCategory.map((c) => (
                  <View key={c.category} accessible>
                    <View className="flex-row justify-between">
                      <Text font="bold" className="text-sm">
                        {t(`extras.money.categories.${c.category}`)}
                      </Text>
                      <Text className="text-sm">
                        {formatMoney(c.amount, false)} · {c.share}%
                      </Text>
                    </View>
                    <View className="mt-1 h-2 rounded-full bg-neutralBg">
                      <View
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${Math.max(c.share, 2)}%` }}
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          <Button
            label={t('extras.flow.seeExpenses')}
            variant="outline"
            size="md"
            onPress={() => router.push('/money-out')}
          />
        </ScrollView>
      )}

      <CalendarSheet
        key={`${choosing}-${range.day}`}
        visible={choosing}
        period={range.period}
        day={range.day ?? null}
        onPeriod={(period) => setRange({ period })}
        onDay={(day) => setRange({ period: range.period, day })}
        onClose={() => setChoosing(false)}
      />
    </SafeAreaView>
  );
}

/**
 * Owner (or a manager allowed to see reports): money in, money out and what is left, cash and
 * bank apart, so the owner always knows where the money came from and where it went.
 */
export default function MoneyFlowScreen() {
  return (
    <FeatureGate feature="featureMoneyOut">
      <Flow />
    </FeatureGate>
  );
}
