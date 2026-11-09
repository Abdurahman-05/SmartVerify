import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Download } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { LoadingView } from '@/components/ui/LoadingView';
import { MoneyText } from '@/components/ui/MoneyText';
import { NoConnection } from '@/components/ui/NoConnection';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { sharePdf } from '@/lib/export';
import {
  type PaymentRecord,
  getPaymentsPage,
  getPaymentsSummary,
  paymentsPagesKey,
  paymentsSummaryKey,
  type PayMethod,
} from '@/lib/history';
import { isDay, isListPeriod, localDay, type ListPeriod } from '@/lib/period';
import { failedChecksKey, getFailedChecks } from '@/lib/verification';
import { useSession } from '@/store/session';
import { useBrandColors } from '@/store/theme';

import { CalendarButton } from './CalendarButton';
import { CalendarSheet } from './CalendarSheet';
import { methodKey } from './methods';
import { PaymentRow } from './PaymentRow';
import { FailedCheckRow } from './FailedCheckRow';
import { buildStatement } from './statement';

/**
 * The filters are Cash and Bank only: a cash + bank payment is listed under both (its row shows
 * the split), so the owner sees all the cash and all the bank money in one place each.
 */
type MoneyFilter = Exclude<PayMethod, 'cash+bank'>;
const moneyFilters: MoneyFilter[] = ['cash', 'bank'];
const isMethod = (value: unknown): value is MoneyFilter =>
  typeof value === 'string' && (moneyFilters as string[]).includes(value);
/** Rows loaded at a time; the next ones load while scrolling down. */
const PAGE = 30;
/** The statement (PDF) holds up to this many rows. */
const STATEMENT_MAX = 500;

/** The list with a day header before each new day (like a phone's call history). */
type ListRow =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'pay'; key: string; payment: PaymentRecord };

function withDayHeaders(
  payments: PaymentRecord[],
  t: (key: string, options?: Record<string, unknown>) => string
): ListRow[] {
  const now = new Date();
  const today = localDay(now);
  const yesterday = localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const label = (when: Date, key: string) => {
    if (key === today) return t('period.today');
    if (key === yesterday) return t('period.yesterday');
    const weekday = t(`period.weekdayFull_${(when.getDay() + 6) % 7}`);
    if (when >= weekAgo) return weekday;
    const date = t('period.day', {
      month: t(`period.month_${when.getMonth()}`),
      day: when.getDate(),
    });
    const year = when.getFullYear() === now.getFullYear() ? '' : ` ${when.getFullYear()}`;
    return t('period.dayHeader', { weekday, date: date + year });
  };
  const rows: ListRow[] = [];
  let last = '';
  for (const payment of payments) {
    const when = new Date(payment.createdAt);
    const key = localDay(when);
    if (key !== last) {
      rows.push({ kind: 'day', key: `day-${key}`, label: label(when, key) });
      last = key;
    }
    rows.push({ kind: 'pay', key: payment.id, payment });
  }
  return rows;
}

function MethodChip({
  label,
  count,
  selected,
  onPress,
}: {
  label: string;
  count: number;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={`h-12 flex-row items-center gap-2 rounded-3xl pl-[18px] pr-3.5 ${
        selected ? 'bg-primary' : 'border-2 border-borderStrong bg-surface'
      }`}
    >
      <Text font="bold" tone={selected ? 'inverse' : 'default'} className="text-[17px]">
        {label}
      </Text>
      <View
        className={`h-[26px] min-w-[26px] items-center justify-center rounded-full px-1.5 ${
          selected ? 'bg-surface' : 'bg-primaryTile'
        }`}
      >
        <Text font="bold" className="text-sm text-primary">
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

/** History: paid bills (cash, bank, cash + bank), and bank checks that failed. */
export default function TransactionsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const businessName = useSession((s) => s.user?.businessName ?? '');
  const params = useLocalSearchParams<{ method?: string; period?: string; day?: string }>();
  // Opens on every transaction (date and time on each row); the calendar narrows it.
  const period: ListPeriod = isListPeriod(params.period) ? params.period : 'all';
  // One chosen day from the calendar, instead of the period.
  const day = isDay(params.day) ? params.day : null;
  const dayDate = day ? new Date(`${day}T12:00:00`) : null;
  const dayLabel = dayDate
    ? t('period.day', { month: t(`period.month_${dayDate.getMonth()}`), day: dayDate.getDate() })
    : '';
  const method = isMethod(params.method) ? params.method : null;
  // "Failed" lists bank receipt checks that did not verify instead of payments.
  const showFailed = params.method === 'failed';
  const [sheet, setSheet] = useState<'period' | null>(null);
  const [downloading, setDownloading] = useState(false);

  const brand = useBrandColors();
  const summaryQuery = useQuery({
    queryKey: paymentsSummaryKey(period, day ?? undefined),
    queryFn: () => getPaymentsSummary(period, day ?? undefined),
  });
  // The list comes a page at a time: the oldest row shown is where the next page starts.
  const query = useInfiniteQuery({
    queryKey: paymentsPagesKey(period, day ?? undefined, method ?? undefined),
    queryFn: ({ pageParam }) =>
      getPaymentsPage(period, {
        day: day ?? undefined,
        money: method ?? undefined,
        before: pageParam,
        limit: PAGE,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.length < PAGE ? undefined : last[last.length - 1]?.createdAt),
  });
  const failedQuery = useQuery({
    queryKey: failedChecksKey(period, day ?? undefined),
    queryFn: () => getFailedChecks(period, day ?? undefined),
  });
  const { refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = query;
  const { refetch: refetchSummary } = summaryQuery;
  const { refetch: refetchFailed } = failedQuery;
  useFocusEffect(
    useCallback(() => {
      void refetch();
      void refetchSummary();
      void refetchFailed();
    }, [refetch, refetchSummary, refetchFailed])
  );

  if (query.isPending) return <LoadingView screenTitle={t('transactions.title')} />;
  if (query.isError && !query.data && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void refetch()} />;
  }

  const visible = showFailed ? [] : (query.data?.pages.flat() ?? []);
  // One chosen day has no headers (the title already says the day).
  const rows: ListRow[] = day
    ? visible.map((payment) => ({ kind: 'pay', key: payment.id, payment }))
    : withDayHeaders(visible, t);
  const failedChecks = failedQuery.data ?? [];
  const summary = summaryQuery.data;
  const totalCount = summary?.count ?? 0;
  const salesTotal = summary?.salesEtb ?? 0;
  const countFor = (m: MoneyFilter) =>
    (m === 'cash' ? summary?.cashCount : summary?.bankCount) ?? 0;
  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  };
  const methodLabel = method ? t(methodKey(method)) : t('history.method.all');

  const download = async () => {
    setDownloading(true);
    try {
      // The statement covers the whole period, not only the rows scrolled so far.
      const rows = await getPaymentsPage(period, {
        day: day ?? undefined,
        money: method ?? undefined,
        limit: STATEMENT_MAX,
      });
      await sharePdf(
        buildStatement(t, rows, methodLabel, day ? dayLabel : t(`period.${period}`), businessName)
      );
    } catch {
      Alert.alert(t('common.error'), t('transactions.downloadFailed'));
    } finally {
      setDownloading(false);
    }
  };

  const header = (
    <View>
      <View className="mx-4 rounded-card bg-primary px-5 py-3">
        <Text font="semibold" tone="inverse" className="text-[15px]">
          {day
            ? t('history.summary_day', { date: dayLabel, count: totalCount })
            : t(`history.summary_${period}`, { count: totalCount })}
        </Text>
        <MoneyText
          value={salesTotal}
          tone="inverse"
          className="text-[32px]"
          numberOfLines={1}
          adjustsFontSizeToFit
        />
      </View>

      <View className="pb-2 pt-3">
        <Text font="bold" tone="muted" className="mb-1.5 px-4 text-[15px]">
          {t('history.chooseMethod')}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
          accessibilityRole="radiogroup"
        >
          <MethodChip
            label={t('history.method.all')}
            count={totalCount}
            selected={!method && !showFailed}
            onPress={() => router.setParams({ method: undefined })}
          />
          {moneyFilters.map((m) => (
            <MethodChip
              key={m}
              label={t(methodKey(m))}
              count={countFor(m)}
              selected={method === m}
              onPress={() => router.setParams({ method: m })}
            />
          ))}
          <MethodChip
            label={t('history.method.failed')}
            count={failedChecks.length}
            selected={showFailed}
            onPress={() => router.setParams({ method: 'failed' })}
          />
        </ScrollView>
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScreenHeader
        title={t('transactions.title')}
        onBack={() => router.navigate('/home')}
        right={<CalendarButton day={dayDate} onPress={() => setSheet('period')} />}
      />

      {showFailed ? (
        <FlatList
          data={failedChecks}
          keyExtractor={(c) => c.id}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: 12 }}
          ItemSeparatorComponent={() => <View className="h-2" />}
          renderItem={({ item }) => (
            <View className="px-4">
              <FailedCheckRow check={item} showDate={!day && period !== 'today'} />
            </View>
          )}
          ListEmptyComponent={
            <Text tone="muted" className="px-6 pt-10 text-center text-lg">
              {failedQuery.isError
                ? `${t('history.loadFailed')} ${t(errorMessageKey(failedQuery.error))}`
                : t('history.failed.empty')}
            </Text>
          }
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: 12 }}
          ItemSeparatorComponent={() => <View className="h-2" />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator
                color={brand.primary}
                className="py-4"
                accessibilityLabel={t('loading.title')}
              />
            ) : undefined
          }
          renderItem={({ item }) =>
            item.kind === 'day' ? (
              <Text
                font="bold"
                tone="muted"
                className="px-5 pb-0.5 pt-3 text-[15px]"
                accessibilityRole="header"
              >
                {item.label}
              </Text>
            ) : (
              <View className="px-4">
                <PaymentRow
                  payment={item.payment}
                  // The day header above says the date: each row shows its time.
                  showDate={false}
                  onPress={() =>
                    router.push({
                      pathname: '/transaction/[id]',
                      params: { id: item.payment.id },
                    })
                  }
                />
              </View>
            )
          }
          ListEmptyComponent={
            <Text tone="muted" className="px-6 pt-10 text-center text-lg">
              {query.isError
                ? `${t('history.loadFailed')} ${t(errorMessageKey(query.error))}`
                : t('history.empty')}
            </Text>
          }
        />
      )}

      <View className="px-4 py-2.5">
        <Button
          label={t('history.download')}
          icon={Download}
          variant="outline"
          size="md"
          disabled={downloading || visible.length === 0}
          onPress={download}
        />
      </View>

      <CalendarSheet
        key={`${sheet}-${day}`}
        visible={sheet === 'period'}
        period={period}
        withAll
        day={day}
        onPeriod={(p) => router.setParams({ period: p, day: '' })}
        onDay={(d) => router.setParams({ day: d })}
        onClose={() => setSheet(null)}
      />
    </SafeAreaView>
  );
}
