import { useQuery } from '@tanstack/react-query';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Flame,
  Plus,
  ShoppingCart,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GhostButton } from '@/components/ui/GhostButton';
import { GlassCard } from '@/components/ui/GlassCard';
import { useGlass } from '@/components/ui/glassTokens';
import { HeroCard, HeroChip } from '@/components/ui/HeroCard';
import { IconTile } from '@/components/ui/IconTile';
import { LoadingView } from '@/components/ui/LoadingView';
import { formatMoney } from '@/components/ui/MoneyText';
import { NoConnection } from '@/components/ui/NoConnection';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { Segmented } from '@/components/ui/Segmented';
import { StickyFooter } from '@/components/ui/StickyFooter';
import { Text } from '@/components/ui/Text';
import { TopBar } from '@/components/ui/TopBar';
import { CalendarSheet } from '@/features/transactions/CalendarSheet';
import { ApiError } from '@/lib/api/client';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import {
  expensesKey,
  getExpenses,
  getMoneyFlow,
  moneyFlowKey,
  type ExpenseRange,
} from '@/lib/extras';
import { formatTime } from '@/lib/format';
import { periods, type Period } from '@/lib/period';
import { useSession } from '@/store/session';
import { colors } from '@/theme/tokens';

import { AddSpendingSheet, type SpendingKind } from './AddSpendingSheet';
import { FeatureGate } from './FeatureGate';

// Design: docs/design/owner/screens/04-money-flow.png
const BAR_COLORS = { sales: '#FFFFFF', other: '#FDE047', costs: '#FCA5A5' } as const;

/** One hero bar: label and amount above a thin track filled by share of the biggest amount. */
function FlowBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const share = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <View accessible accessibilityLabel={`${label}: ${formatMoney(value, false)}`}>
      <View className="flex-row items-center justify-between">
        <Text tone="inverse" className="text-[15px] opacity-90">
          {label}
        </Text>
        <Text font="heading" tone="inverse" className="text-[15px]">
          {formatMoney(value, false)}
        </Text>
      </View>
      <View
        className="mt-1.5 h-2 overflow-hidden rounded-[4px]"
        style={{ backgroundColor: 'rgba(255,255,255,0.22)' }}
      >
        <View
          className="h-2 rounded-[4px]"
          style={{ width: `${share * 100}%`, backgroundColor: color }}
        />
      </View>
    </View>
  );
}

/** "See all" style link on the right of a section title. */
function SectionLink({ label, onPress }: { label: string; onPress: () => void }) {
  const g = useGlass();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      hitSlop={10}
      className="min-h-11 justify-center active:opacity-70"
    >
      <Text font="bold" className="text-sm" style={{ color: g.primaryText }}>
        {label}
      </Text>
    </Pressable>
  );
}

function Flow() {
  const { t } = useTranslation();
  const router = useRouter();
  const [range, setRange] = useState<ExpenseRange>({ period: 'today' });
  const [choosing, setChoosing] = useState(false);

  const query = useQuery({ queryKey: moneyFlowKey(range), queryFn: () => getMoneyFlow(range) });
  // The latest money out (same list as the Money out screen) and the add sheet.
  const latest = useQuery({ queryKey: expensesKey(range), queryFn: () => getExpenses(range) });
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<SpendingKind>('purchase');
  const add = (next: SpendingKind) => {
    setKind(next);
    setAdding(true);
  };
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/home'));

  if (query.isPending) return <LoadingView screenTitle={t('extras.flow.title')} onBack={goBack} />;
  if (query.isError && !query.data && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void refetch()} />;
  }

  const dayDate = range.day ? new Date(`${range.day}T12:00:00`) : null;
  const dayLabel = dayDate
    ? t('period.day', { month: t(`period.month_${dayDate.getMonth()}`), day: dayDate.getDate() })
    : null;
  const flow = query.data;
  const forbidden = query.error instanceof ApiError && query.error.code === 'FORBIDDEN';
  const entries = (latest.data?.entries ?? []).filter((e) => !e.deletedAt);

  const sales = flow?.sales.total ?? 0;
  // Business costs = the owner's cost kinds (rent, gas, salary...); other = the rest.
  const costs = flow?.costs.total ?? 0;
  const other = flow?.other.total ?? 0;
  const left = flow?.left.total ?? 0;
  const keptPct = sales > 0 ? Math.round((Math.max(left, 0) / sales) * 100) : 0;
  const barMax = Math.max(sales, costs, other);

  return (
    <ScreenBackground>
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="px-4 pb-3 pt-2">
          <TopBar
            title={t('extras.flow.title')}
            subtitle={
              dayLabel ? `${t('extras.flow.ownerOnly')} · ${dayLabel}` : t('extras.flow.ownerOnly')
            }
            left={{ icon: ChevronLeft, onPress: goBack, label: t('common.back') }}
            right={{
              icon: CalendarDays,
              onPress: () => setChoosing(true),
              label: t('extras.flow.pickDay'),
            }}
          />
        </View>
        <View className="px-4 pb-3">
          <Segmented<Period | 'day'>
            options={periods.map((p) => ({ value: p, label: t(`period.${p}`) }))}
            // A day from the calendar: no period is chosen.
            value={range.day ? 'day' : range.period}
            onChange={(p) => p !== 'day' && setRange({ period: p })}
          />
        </View>

        {!flow ? (
          <Text tone="muted" className="px-6 pt-6 text-center text-lg">
            {forbidden ? t('extras.flow.notAllowed') : t(errorMessageKey(query.error))}
          </Text>
        ) : (
          <ScrollView
            contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingBottom: 110 }}
          >
            <HeroCard>
              <Text font="bold" tone="inverse" className="text-[13px] uppercase opacity-90">
                {t('extras.flow.leftAfterCosts')}
              </Text>
              <View className="flex-row items-end justify-between gap-2">
                <Text
                  font="heading"
                  tone="inverse"
                  className="flex-1 text-[34px] leading-[40px]"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {left < 0 ? '− ' : ''}
                  {formatMoney(Math.abs(left), false)}{' '}
                  <Text font="heading" tone="inverse" className="text-base">
                    {t('common.etb')}
                  </Text>
                </Text>
                {sales > 0 ? (
                  <HeroChip style={{ marginBottom: 4, paddingVertical: 4 }}>
                    <Text font="bold" tone="inverse" className="text-[13px]">
                      {t('extras.flow.kept', { pct: keptPct })}
                    </Text>
                  </HeroChip>
                ) : null}
              </View>
              <View className="mt-3 gap-3">
                <FlowBar
                  label={t('extras.flow.salesIn')}
                  value={sales}
                  max={barMax}
                  color={BAR_COLORS.sales}
                />
                <FlowBar
                  label={t('extras.flow.other')}
                  value={other}
                  max={barMax}
                  color={BAR_COLORS.other}
                />
                <FlowBar
                  label={t('extras.flow.costs')}
                  value={costs}
                  max={barMax}
                  color={BAR_COLORS.costs}
                />
              </View>
            </HeroCard>

            <View className="flex-row items-center justify-between">
              <Text font="bold" className="flex-1 text-base" accessibilityRole="header">
                {t('extras.flow.latest')}
              </Text>
              <SectionLink
                label={t('extras.flow.seeAll')}
                onPress={() => router.push('/money-out')}
              />
            </View>
            <GlassCard style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
              {entries.length === 0 ? (
                <Text tone="muted" className="py-3 text-sm">
                  {t('extras.flow.noExpenses')}
                </Text>
              ) : (
                entries.slice(0, 3).map((e, i) => (
                  <Pressable
                    key={e.id}
                    onPress={() => router.push(`/expense/${e.id}`)}
                    accessibilityRole="button"
                    className={`flex-row items-center gap-3 py-3 active:opacity-70 ${i ? 'border-t border-black/[0.07]' : ''}`}
                  >
                    <IconTile
                      icon={e.isCost ? Flame : ShoppingCart}
                      tone={e.isCost ? 'amber' : 'brand'}
                    />
                    <View className="min-w-0 flex-1">
                      <Text font="bold" className="text-[15px]" numberOfLines={1}>
                        {e.title}
                      </Text>
                      <Text tone="muted" className="text-sm" numberOfLines={1}>
                        {[
                          t(`extras.money.categories.${e.category}`),
                          e.createdBy,
                          formatTime(e.createdAt),
                        ].join(' · ')}
                      </Text>
                    </View>
                    <Text font="heading" className="text-[15px]">
                      − {formatMoney(e.amount, false)}
                    </Text>
                  </Pressable>
                ))
              )}
            </GlassCard>

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

            {flow.byCategory.length > 0 ? (
              <>
                <View className="flex-row items-center justify-between">
                  <Text font="bold" className="flex-1 text-base" accessibilityRole="header">
                    {t('extras.flow.whereWent')}
                  </Text>
                  <SectionLink
                    label={t('extras.flow.seeExpenses')}
                    onPress={() => router.push('/money-out')}
                  />
                </View>
                <GlassCard style={{ padding: 14, gap: 10 }}>
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
                      <View className="mt-1 h-2 rounded-full bg-black/[0.06]">
                        <View
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${Math.max(c.share, 2)}%` }}
                        />
                      </View>
                    </View>
                  ))}
                </GlassCard>
              </>
            ) : null}
          </ScrollView>
        )}

        {flow ? (
          <StickyFooter>
            <View className="flex-row gap-2.5">
              <View className="flex-1">
                <PrimaryButton
                  label={t('extras.money.purchase')}
                  icon={Plus}
                  onPress={() => add('purchase')}
                />
              </View>
              <View className="flex-1">
                <GhostButton
                  label={t('extras.money.expense')}
                  icon={Plus}
                  onPress={() => add('expense')}
                />
              </View>
            </View>
          </StickyFooter>
        ) : null}

        <AddSpendingSheet
          // A new kind opens a fresh form.
          key={kind}
          visible={adding}
          initialKind={kind}
          onClose={() => setAdding(false)}
        />
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
    </ScreenBackground>
  );
}

/** Owner only: money in, money out and what is left. Anyone else goes back to Home. */
export default function MoneyFlowScreen() {
  const isOwner = useSession((s) => s.user?.role === 'owner');
  if (!isOwner) return <Redirect href="/home" />;
  return (
    <FeatureGate feature="featureMoneyOut">
      <Flow />
    </FeatureGate>
  );
}
