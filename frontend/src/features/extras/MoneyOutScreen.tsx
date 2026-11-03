import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { Banknote, Landmark, Plus, type LucideIcon } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { LoadingView } from '@/components/ui/LoadingView';
import { MoneyText } from '@/components/ui/MoneyText';
import { NoConnection } from '@/components/ui/NoConnection';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { CalendarButton } from '@/features/transactions/CalendarButton';
import { CalendarSheet } from '@/features/transactions/CalendarSheet';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { formatDay, formatTime } from '@/lib/format';
import { expensesKey, getExpenses, type Expense, type ExpenseRange } from '@/lib/extras';
import { useBrandColors } from '@/store/theme';

import { AddSpendingSheet } from './AddSpendingSheet';
import { FeatureGate } from './FeatureGate';

type Filter = 'all' | 'cash' | 'bank' | 'new';

function TotalBox({
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

function FilterChip({
  label,
  selected,
  warn,
  onPress,
}: {
  label: string;
  selected: boolean;
  /** "New": amber, like everything waiting for the owner. */
  warn?: boolean;
  onPress: () => void;
}) {
  const look = selected
    ? 'bg-primary'
    : warn
      ? 'border-2 border-amber bg-tipBg'
      : 'border-2 border-borderStrong bg-surface';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={`h-12 items-center justify-center rounded-3xl px-[18px] ${look}`}
    >
      <Text font="bold" tone={selected ? 'inverse' : 'default'} className="text-base">
        {label}
      </Text>
    </Pressable>
  );
}

/** One expense: new ones are marked, deleted ones stay crossed out with the reason. */
export function ExpenseRow({
  entry,
  showDate,
  onPress,
}: {
  entry: Expense;
  showDate: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const deleted = !!entry.deletedAt;
  const when = showDate
    ? `${formatDay(entry.createdAt, false)}, ${formatTime(entry.createdAt)}`
    : formatTime(entry.createdAt);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`flex-row items-center gap-3 rounded-[18px] px-3.5 py-2.5 active:opacity-80 ${
        deleted
          ? 'border-[1.5px] border-dashed border-border bg-dangerSurface'
          : 'border-[1.5px] border-border bg-surface'
      }`}
    >
      <View className="min-w-0 flex-1">
        <Text
          font="bold"
          className={`text-base ${deleted ? 'line-through' : ''}`}
          tone={deleted ? 'muted' : 'default'}
          numberOfLines={1}
        >
          {entry.title}
        </Text>
        <Text tone="muted" className="text-sm" numberOfLines={1}>
          {[t(`extras.money.categories.${entry.category}`), entry.createdBy, when].join(' · ')}
        </Text>
        {deleted ? (
          <Text className="text-sm text-dangerFg" numberOfLines={1}>
            {t('extras.money.deleted', { reason: entry.deleteReason ?? '' })}
          </Text>
        ) : null}
      </View>
      <View className="items-end gap-1">
        <MoneyText
          value={entry.amount}
          font="bold"
          className={`text-lg ${deleted ? 'line-through' : ''}`}
        />
        <View className="flex-row gap-1">
          {entry.isNew ? (
            <Text font="bold" className="rounded-lg bg-warnBg px-1.5 text-sm text-warnFg">
              {t('extras.money.new')}
            </Text>
          ) : null}
          <Text font="bold" className="rounded-lg bg-neutralBg px-1.5 text-sm">
            {t(entry.paidFrom === 'CASH' ? 'extras.cash' : 'extras.bank')}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function MoneyOut() {
  const { t } = useTranslation();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [range, setRange] = useState<ExpenseRange>({ period: 'today' });
  const [choosing, setChoosing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const query = useQuery({ queryKey: expensesKey(range), queryFn: () => getExpenses(range) });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  if (query.isPending) return <LoadingView screenTitle={t('extras.money.title')} />;
  if (query.isError && !query.data && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void refetch()} />;
  }

  const entries = query.data?.entries ?? [];
  const counted = entries.filter((e) => !e.deletedAt);
  const shown = entries.filter((e) =>
    filter === 'cash'
      ? e.paidFrom === 'CASH'
      : filter === 'bank'
        ? e.paidFrom === 'BANK'
        : filter === 'new'
          ? e.isNew
          : true
  );
  const totals = query.data?.totals;
  const spent = (totals?.cash ?? 0) + (totals?.bank ?? 0);
  const dayDate = range.day ? new Date(`${range.day}T12:00:00`) : null;
  const newCount = query.data?.newCount ?? 0;

  const header = totals ? (
    <View className="gap-2 pb-2">
      <View className="rounded-[20px] bg-primary px-[18px] py-3.5" accessible>
        <Text font="semibold" tone="inverse" className="text-sm opacity-90">
          {range.day
            ? `${t('period.day', {
                month: t(`period.month_${dayDate!.getMonth()}`),
                day: dayDate!.getDate(),
              })} · ${t('extras.money.spentIn', { count: counted.length })}`
            : `${t(`period.${range.period}`)} · ${t('extras.money.spentIn', { count: counted.length })}`}
        </Text>
        <MoneyText value={spent} tone="inverse" className="mt-1 text-[32px]" />
      </View>
      <View className="flex-row gap-2">
        <TotalBox icon={Banknote} label={t('extras.cash')} value={totals.cash} />
        <TotalBox icon={Landmark} label={t('extras.bank')} value={totals.bank} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingTop: 4 }}
        accessibilityRole="radiogroup"
      >
        <FilterChip
          label={`${t('history.method.all')} ${entries.length}`}
          selected={filter === 'all'}
          onPress={() => setFilter('all')}
        />
        <FilterChip
          label={t('extras.cash')}
          selected={filter === 'cash'}
          onPress={() => setFilter('cash')}
        />
        <FilterChip
          label={t('extras.bank')}
          selected={filter === 'bank'}
          onPress={() => setFilter('bank')}
        />
        {newCount > 0 ? (
          <FilterChip
            label={`${t('extras.money.filterNew')} ${newCount}`}
            selected={filter === 'new'}
            warn
            onPress={() => setFilter('new')}
          />
        ) : null}
      </ScrollView>
    </View>
  ) : null;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScreenHeader
        title={t('extras.money.title')}
        subtitle={t('extras.money.subtitle')}
        onBack={() => (router.canGoBack() ? router.back() : router.navigate('/home'))}
        right={<CalendarButton day={dayDate} onPress={() => setChoosing(true)} />}
      />
      <FlatList
        data={shown}
        keyExtractor={(entry) => entry.id}
        ListHeaderComponent={header ?? undefined}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 16 }}
        renderItem={({ item }) => (
          <ExpenseRow
            entry={item}
            showDate={!range.day && range.period !== 'today'}
            onPress={() => router.push(`/expense/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <Text tone="muted" className="px-6 pt-6 text-center text-lg">
            {query.isError ? t(errorMessageKey(query.error)) : t('extras.money.emptyIn')}
          </Text>
        }
      />
      <View className="px-4 pb-3 pt-2">
        <Button label={t('extras.money.add')} icon={Plus} onPress={() => setAdding(true)} />
      </View>
      <AddSpendingSheet visible={adding} onClose={() => setAdding(false)} />
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

/** Manager and owner (money out on): expenses in a period or on a day, and adding one. */
export default function MoneyOutScreen() {
  return (
    <FeatureGate feature="featureMoneyOut">
      <MoneyOut />
    </FeatureGate>
  );
}
