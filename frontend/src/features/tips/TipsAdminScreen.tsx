import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Banknote,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Landmark,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { GlassCard } from '@/components/ui/GlassCard';
import { useGlass } from '@/components/ui/glassTokens';
import { HeroCard, HeroChip } from '@/components/ui/HeroCard';
import { LoadingView } from '@/components/ui/LoadingView';
import { formatMoney } from '@/components/ui/MoneyText';
import { NoConnection } from '@/components/ui/NoConnection';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { StickyFooter } from '@/components/ui/StickyFooter';
import { Text } from '@/components/ui/Text';
import { TopBar } from '@/components/ui/TopBar';
import { CalendarSheet } from '@/features/transactions/CalendarSheet';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { localDay } from '@/lib/period';
import { getStaff, staffKey } from '@/lib/staff';
import { getTips, markTipsPaid, tipsKey } from '@/lib/tips';
import { colors } from '@/theme/tokens';

import type { Tip } from './types';

// Design: docs/design/owner/screens/07-tips-by-waiter.png

/** The server gives tips by period; the last 30 days cover the week strip and the calendar. */
const FETCH_PERIOD = '30d' as const;

interface WaiterTips {
  waiterId: string;
  name: string;
  count: number;
  total: number;
  bank: number;
  cash: number;
  unpaidIds: string[];
  unpaid: number;
}

const emptyWaiter = (waiterId: string, name: string): WaiterTips => ({
  waiterId,
  name,
  count: 0,
  total: 0,
  bank: 0,
  cash: 0,
  unpaidIds: [],
  unpaid: 0,
});

/** Every waiter (with or without tips that day), unpaid first, then paid, then no tips. */
function byWaiter(tips: Tip[], waiters: { id: string; name: string }[]): WaiterTips[] {
  const groups = new Map<string, WaiterTips>();
  for (const w of waiters) groups.set(w.id, emptyWaiter(w.id, w.name));
  for (const tip of tips) {
    const g = groups.get(tip.waiterId) ?? emptyWaiter(tip.waiterId, tip.waiterName ?? '');
    if (!g.name && tip.waiterName) g.name = tip.waiterName;
    g.count += 1;
    g.total += tip.amount;
    g[tip.source] += tip.amount;
    if (!tip.paidOut) {
      g.unpaidIds.push(tip.id);
      g.unpaid += tip.amount;
    }
    groups.set(tip.waiterId, g);
  }
  const rank = (g: WaiterTips) => (g.unpaid > 0 ? 0 : g.count > 0 ? 1 : 2);
  return [...groups.values()].sort(
    (a, b) => rank(a) - rank(b) || b.unpaid - a.unpaid || b.total - a.total
  );
}

const dayAt = (key: string) => new Date(`${key}T12:00:00`);
const addDays = (key: string, n: number) => {
  const d = dayAt(key);
  d.setDate(d.getDate() + n);
  return localDay(d);
};
/** Monday of the week the day is in. */
const weekStart = (key: string) => addDays(key, -((dayAt(key).getDay() + 6) % 7));

/** Glass card: month label with ‹ ›, then the 7 days of the week (Mon–Sun). */
function WeekStrip({
  day,
  onDay,
  onOpenCalendar,
}: {
  day: string;
  onDay: (day: string) => void;
  onOpenCalendar: () => void;
}) {
  const { t } = useTranslation();
  const g = useGlass();
  const todayKey = localDay(new Date());
  const monday = weekStart(day);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const shown = dayAt(day);
  const nextWeek = addDays(monday, 7);
  const arrow = (dir: -1 | 1) => {
    const disabled = dir === 1 && nextWeek > todayKey;
    const Icon = dir === -1 ? ChevronLeft : ChevronRight;
    return (
      <Pressable
        onPress={() => {
          const target = addDays(day, dir * 7);
          onDay(target > todayKey ? todayKey : target);
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={t(dir === -1 ? 'tipsAdmin.prevWeek' : 'tipsAdmin.nextWeek')}
        className="h-11 w-11 items-center justify-center active:opacity-60"
        style={{ opacity: disabled ? 0.3 : 1 }}
      >
        <Icon size={22} color={colors.text} strokeWidth={2.2} />
      </Pressable>
    );
  };
  return (
    <GlassCard style={{ padding: 10, gap: 6 }}>
      <View className="flex-row items-center">
        {arrow(-1)}
        <Pressable
          onPress={onOpenCalendar}
          accessibilityRole="button"
          accessibilityLabel={t('period.choose')}
          className="min-h-11 flex-1 items-center justify-center active:opacity-70"
        >
          <Text font="bold" className="text-base">
            {`${t(`period.month_${shown.getMonth()}`)} ${shown.getFullYear()}`}
          </Text>
        </Pressable>
        {arrow(1)}
      </View>
      <View className="flex-row gap-1.5">
        {days.map((key, i) => {
          const selected = key === day;
          const future = key > todayKey;
          const color = selected ? '#FFFFFF' : future ? colors.placeholder : colors.text;
          return (
            <Pressable
              key={key}
              onPress={() => onDay(key)}
              disabled={future}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: future }}
              accessibilityLabel={`${t(`period.weekdayFull_${i}`)} ${dayAt(key).getDate()}`}
              className="h-[58px] flex-1 items-center justify-center overflow-hidden rounded-[18px]"
              style={{
                backgroundColor: selected ? undefined : 'rgba(255,255,255,0.5)',
                borderWidth: selected ? 0 : 1,
                borderColor: 'rgba(255,255,255,0.9)',
                opacity: future ? 0.55 : 1,
              }}
            >
              {selected ? (
                <LinearGradient
                  colors={[g.primary2, g.primary]}
                  style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
                />
              ) : null}
              <Text font="bold" className="text-[13px]" style={{ color }}>
                {t(`period.weekday_${i}`)}
              </Text>
              <Text font="heading" className="text-lg leading-6" style={{ color }}>
                {dayAt(key).getDate()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </GlassCard>
  );
}

/** One waiter: initials avatar, name, tip split, amount and Pay / Paid / —. */
function WaiterRow({
  item,
  first,
  paying,
  onPay,
}: {
  item: WaiterTips;
  first: boolean;
  paying: boolean;
  onPay: () => void;
}) {
  const { t } = useTranslation();
  const g = useGlass();
  const parts = [
    item.bank ? `${t('extras.bank').toLowerCase()} ${formatMoney(item.bank, false)}` : null,
    item.cash ? `${t('extras.cash').toLowerCase()} ${formatMoney(item.cash, false)}` : null,
  ].filter(Boolean);
  const detail = item.count
    ? [t('tipsAdmin.tipCount', { count: item.count }), ...parts].join(' · ')
    : t('tipsAdmin.noTipsYet');
  const toPay = item.unpaid > 0;
  return (
    <View
      className={`flex-row items-center gap-3 py-3 ${first ? '' : 'border-t border-black/[0.07]'}`}
      style={{ opacity: toPay ? 1 : 0.7 }}
    >
      <LinearGradient
        colors={item.count ? [g.primary2, g.primary] : ['#D6CFCB', '#B9AEB3']}
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text font="bold" tone="inverse" className="text-[17px]">
          {(item.name.charAt(0) || '?').toUpperCase()}
        </Text>
      </LinearGradient>
      <View className="min-w-0 flex-1">
        <Text font="bold" className="text-base" numberOfLines={1}>
          {item.name}
        </Text>
        <Text tone="muted" className="text-[13px]" numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <Text font="heading" className="text-base">
        {formatMoney(toPay ? item.unpaid : item.total, false)}
      </Text>
      {toPay ? (
        <Pressable
          onPress={onPay}
          disabled={paying}
          accessibilityRole="button"
          accessibilityLabel={`${t('tipsAdmin.pay')} ${item.name}`}
          className="min-h-11 justify-center active:opacity-80"
        >
          <LinearGradient
            colors={[g.primary2, g.primary]}
            style={{
              height: 34,
              borderRadius: 17,
              paddingHorizontal: 16,
              justifyContent: 'center',
            }}
          >
            <Text font="bold" tone="inverse" className="text-sm">
              {t('tipsAdmin.pay')}
            </Text>
          </LinearGradient>
        </Pressable>
      ) : item.count ? (
        <View className="h-7 flex-row items-center gap-1 rounded-[14px] bg-successBg px-2.5">
          <Check size={14} color={colors.successFg} strokeWidth={2.6} />
          <Text font="bold" className="text-[13px]" style={{ color: colors.successFg }}>
            {t('tipsAdmin.paid')}
          </Text>
        </View>
      ) : (
        <Text font="bold" className="w-12 text-center text-base" style={{ color: colors.muted }}>
          —
        </Text>
      )}
    </View>
  );
}

/** Owner / manager: every waiter's tips for one day, paid out at the end of the day. */
export default function TipsAdminScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [day, setDay] = useState(() => localDay(new Date()));
  const [choosing, setChoosing] = useState(false);

  const query = useQuery({
    queryKey: tipsKey(FETCH_PERIOD, 'all'),
    queryFn: () => getTips(FETCH_PERIOD),
  });
  // The whole team, so waiters without tips are listed too.
  const staff = useQuery({ queryKey: staffKey, queryFn: getStaff });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );
  const markPaid = useMutation({
    mutationFn: markTipsPaid,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tips'] }),
  });

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/admin'));

  if (query.isPending) return <LoadingView screenTitle={t('tipsAdmin.title')} onBack={goBack} />;
  if (query.isError && !query.data && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void refetch()} />;
  }

  const dayTips = (query.data ?? []).filter((tip) => localDay(new Date(tip.createdAt)) === day);
  const waiters = (staff.data ?? [])
    .filter((m) => m.role === 'waiter' && m.active)
    .map((m) => ({ id: m.id, name: m.name }));
  const groups = byWaiter(dayTips, waiters);
  const unpaidIds = groups.flatMap((g) => g.unpaidIds);
  const unpaidTips = dayTips.filter((tip) => !tip.paidOut);
  const toPay = unpaidTips.reduce((s, tip) => s + tip.amount, 0);
  const paid = dayTips.filter((tip) => tip.paidOut).reduce((s, tip) => s + tip.amount, 0);
  const sum = (source: Tip['source']) =>
    unpaidTips.filter((tip) => tip.source === source).reduce((s, tip) => s + tip.amount, 0);
  const shown = dayAt(day);
  const dayLabel = `${t(`period.weekday_${(shown.getDay() + 6) % 7}`)} ${shown.getDate()}`;

  return (
    <ScreenBackground>
      <SafeAreaView className="flex-1">
        <View className="px-4 pb-3 pt-2">
          <TopBar
            title={t('tipsAdmin.title')}
            subtitle={t('tipsAdmin.subtitle')}
            left={{ icon: ChevronLeft, onPress: goBack, label: t('common.back') }}
            right={{
              icon: CalendarDays,
              onPress: () => setChoosing(true),
              label: t('period.choose'),
            }}
          />
        </View>

        <ScrollView contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingBottom: 110 }}>
          <WeekStrip day={day} onDay={setDay} onOpenCalendar={() => setChoosing(true)} />

          <HeroCard>
            <View className="flex-row items-start gap-3">
              <View className="flex-1" accessible>
                <Text font="bold" tone="inverse" className="text-[13px] uppercase opacity-90">
                  {`${t('tipsAdmin.toPayOut')} · ${dayLabel}`}
                </Text>
                <Text font="heading" tone="inverse" className="text-[34px] leading-[40px]">
                  {formatMoney(toPay, false)}{' '}
                  <Text font="heading" tone="inverse" className="text-base">
                    {t('common.etb')}
                  </Text>
                </Text>
                <Text tone="inverse" className="text-sm opacity-90" numberOfLines={1}>
                  {[
                    t('tipsAdmin.waiters', { count: groups.filter((g) => g.count).length }),
                    t('tipsAdmin.tipCount', { count: dayTips.length }),
                    t('tipsAdmin.paidAmount', { amount: formatMoney(paid, false) }),
                  ].join(' · ')}
                </Text>
              </View>
              <HeroChip
                style={{
                  width: 56,
                  height: 56,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 0,
                }}
              >
                <CircleDollarSign size={28} color="#FFFFFF" strokeWidth={2} />
              </HeroChip>
            </View>
            <View className="mt-3 flex-row gap-2">
              {[
                { icon: Landmark, label: t('extras.bank'), value: sum('bank') },
                { icon: Banknote, label: t('extras.cash'), value: sum('cash') },
              ].map(({ icon: Icon, label, value }) => (
                <HeroChip
                  key={label}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                >
                  <Icon size={20} color="#FFFFFF" strokeWidth={2} />
                  <View accessible>
                    <Text tone="inverse" className="text-[13px] opacity-90">
                      {label}
                    </Text>
                    <Text font="heading" tone="inverse" className="text-lg leading-6">
                      {formatMoney(value, false)}
                    </Text>
                  </View>
                </HeroChip>
              ))}
            </View>
          </HeroCard>

          <View className="flex-row items-center justify-between">
            <Text font="bold" className="text-base" accessibilityRole="header">
              {`${t('tipsAdmin.allWaiters')} · ${groups.length}`}
            </Text>
            <Text className="text-sm" style={{ color: colors.muted }}>
              {t('tipsAdmin.unpaidFirst')}
            </Text>
          </View>
          <GlassCard style={{ paddingHorizontal: 14, paddingVertical: 2 }}>
            {groups.length === 0 ? (
              <Text tone="muted" className="py-4 text-center text-base">
                {query.isError ? t(errorMessageKey(query.error)) : t('tipsAdmin.empty')}
              </Text>
            ) : (
              groups.map((item, i) => (
                <WaiterRow
                  key={item.waiterId}
                  item={item}
                  first={i === 0}
                  paying={markPaid.isPending}
                  onPay={() => markPaid.mutate(item.unpaidIds)}
                />
              ))
            )}
          </GlassCard>
        </ScrollView>

        {unpaidIds.length ? (
          <StickyFooter>
            <PrimaryButton
              icon={Check}
              label={t('tipsAdmin.payAll', { amount: formatMoney(toPay, false) })}
              loading={markPaid.isPending}
              onPress={() => markPaid.mutate(unpaidIds)}
            />
          </StickyFooter>
        ) : null}

        <CalendarSheet
          key={`${choosing}-${day}`}
          visible={choosing}
          period="today"
          day={day}
          // Today / 7 days / 30 days all start from today here: the list shows one day.
          onPeriod={() => setDay(localDay(new Date()))}
          onDay={setDay}
          onClose={() => setChoosing(false)}
        />
        <ErrorDialog
          visible={markPaid.isError}
          title={t('tipsAdmin.failedTitle')}
          message={t(errorMessageKey(markPaid.error))}
          actionLabel={t('errors.retry')}
          onClose={markPaid.reset}
        />
      </SafeAreaView>
    </ScreenBackground>
  );
}
