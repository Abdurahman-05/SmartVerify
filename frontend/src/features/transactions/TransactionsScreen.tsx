import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Download, Search, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GhostButton } from '@/components/ui/GhostButton';
import { alpha, useGlass } from '@/components/ui/glassTokens';
import { LoadingView } from '@/components/ui/LoadingView';
import { formatMoney, MoneyText } from '@/components/ui/MoneyText';
import { NoConnection } from '@/components/ui/NoConnection';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Segmented } from '@/components/ui/Segmented';
import { Text } from '@/components/ui/Text';
import { bankAccountsKey, getBankAccounts, type BankAccount } from '@/lib/bankAccounts';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { sharePdf } from '@/lib/export';
import {
  type PaymentRecord,
  getPaymentsPage,
  getPaymentsSummary,
  paymentsPagesKey,
  paymentsSummaryKey,
} from '@/lib/history';
import { isDay, isPeriod, localDay, periods, type Period } from '@/lib/period';
import { failedChecksKey, getFailedChecks } from '@/lib/verification';
import { useSession } from '@/store/session';
import { colors } from '@/theme/tokens';
import { GlassCard, HeroCard, ScreenBg } from '@/ui/glass';

import { CalendarButton } from './CalendarButton';
import { CalendarSheet } from './CalendarSheet';
import { FailedCheckRow } from './FailedCheckRow';
import { methodKey } from './methods';
import { PaymentRow } from './PaymentRow';
import { buildStatement } from './statement';

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

type Position = 'single' | 'first' | 'middle' | 'last';

/** Where a row sits in its run of rows (day headings split the runs). */
function positionAt(list: { kind: string }[], i: number): Position {
  const before = list[i - 1]?.kind === 'pay';
  const after = list[i + 1]?.kind === 'pay';
  return before ? (after ? 'middle' : 'last') : after ? 'first' : 'single';
}

const firstName = (name: string | null) => name?.trim().split(/\s+/)[0] ?? '';

/** The name on an account card: the holder's first name, made unique within its bank. */
export function accountName(account: BankAccount, sameBank: BankAccount[]) {
  const name = firstName(account.holderName);
  const clash = sameBank.some((a) => a.id !== account.id && firstName(a.holderName) === name);
  if (!name) return `••${account.last4}`;
  return clash ? `${name} ••${account.last4}` : name;
}

/** Saved accounts grouped by bank, in the order they were added. */
function banksOf(accounts: BankAccount[]) {
  const groups: { code: string; name: string; accounts: BankAccount[] }[] = [];
  for (const account of accounts) {
    const group = groups.find((g) => g.code === account.bankCode);
    if (group) group.accounts.push(account);
    else groups.push({ code: account.bankCode, name: account.shortName, accounts: [account] });
  }
  return groups;
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const g = useGlass();
  if (selected) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        className="h-11 justify-center rounded-[22px] px-4 active:opacity-80"
        style={{
          backgroundColor: g.primaryDeep,
          boxShadow: `0 6px 14px ${alpha(g.primary, 0.24)}`,
        }}
      >
        <Text font="bold" tone="inverse" className="text-[15px]">
          {label}
        </Text>
      </Pressable>
    );
  }
  return (
    <GlassCard
      radius={22}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className="h-11 justify-center px-4"
    >
      <Text font="bold" className="text-[15px]">
        {label}
      </Text>
    </GlassCard>
  );
}

function AccountCard({
  name,
  totalEtb,
  count,
  selected,
  onPress,
}: {
  name: string;
  totalEtb: number;
  count: number;
  selected: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const g = useGlass();
  const tone = selected ? 'inverse' : 'default';
  const body = (
    <>
      <View className="flex-row items-center gap-2">
        <View
          className="h-7 w-7 items-center justify-center rounded-full"
          style={{ backgroundColor: selected ? 'rgba(255,255,255,0.25)' : g.primaryDeep }}
        >
          <Text font="bold" tone="inverse" className="text-sm">
            {name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text font="bold" tone={tone} className="flex-1 text-[15px]" numberOfLines={1}>
          {name}
        </Text>
      </View>
      <Text font="bold" tone={tone} className="text-[15px]" numberOfLines={1}>
        {formatMoney(totalEtb, false)}
        <Text tone={tone} className="text-sm">
          {' '}
          · {count}
        </Text>
      </Text>
    </>
  );
  const a11y = {
    accessibilityRole: 'radio' as const,
    accessibilityState: { selected },
    accessibilityLabel: t('transactions.accountCard', {
      name,
      amount: formatMoney(totalEtb),
      count,
    }),
  };
  if (selected) {
    return (
      <Pressable
        onPress={onPress}
        {...a11y}
        className="h-[72px] w-[108px] justify-between rounded-[18px] p-2.5 active:opacity-80"
        style={{
          backgroundColor: g.primaryDeep,
          boxShadow: `0 8px 18px ${alpha(g.primary, 0.24)}`,
        }}
      >
        {body}
      </Pressable>
    );
  }
  return (
    <GlassCard
      radius={18}
      onPress={onPress}
      {...a11y}
      className="h-[72px] w-[108px] justify-between p-2.5"
    >
      {body}
    </GlassCard>
  );
}

/** History: paid bills (cash, bank, cash + bank), and bank checks that failed. */
export default function TransactionsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const g = useGlass();
  const businessName = useSession((s) => s.user?.businessName ?? '');
  const params = useLocalSearchParams<{
    method?: string;
    bank?: string;
    account?: string;
    period?: string;
    day?: string;
  }>();
  const period: Period = isPeriod(params.period) ? params.period : 'today';
  // One chosen day from the calendar, instead of the period.
  const day = isDay(params.day) ? params.day : null;
  const shownDate = day ? new Date(`${day}T12:00:00`) : new Date();
  const dateLabel = t('period.dayHeader', {
    weekday: t(`period.weekday_${(shownDate.getDay() + 6) % 7}`),
    date: t('period.day', {
      month: t(`period.month_${shownDate.getMonth()}`),
      day: shownDate.getDate(),
    }),
  });
  const showFailed = params.method === 'failed';
  const cashOnly = params.method === 'cash';
  const [sheet, setSheet] = useState<'period' | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState('');

  // Bank chips and account cards come from the saved bank accounts.
  const accountsQuery = useQuery({ queryKey: bankAccountsKey, queryFn: getBankAccounts });
  const banks = banksOf(accountsQuery.data ?? []);
  const bank = !showFailed && !cashOnly ? banks.find((b) => b.code === params.bank) : undefined;
  // Account cards only when the bank has two or more accounts; one account is the bank itself.
  const showAccounts = !!bank && bank.accounts.length >= 2;
  const account = showAccounts ? bank.accounts.find((a) => a.id === params.account) : undefined;
  const money = cashOnly ? 'cash' : params.method === 'bank' || bank ? 'bank' : undefined;
  const bankFilter = account ? account.id : bank?.code;

  const summaryQuery = useQuery({
    queryKey: paymentsSummaryKey(period, day ?? undefined),
    queryFn: () => getPaymentsSummary(period, day ?? undefined),
  });
  // The list comes a page at a time: the oldest row shown is where the next page starts.
  const query = useInfiniteQuery({
    queryKey: paymentsPagesKey(period, day ?? undefined, money, bankFilter),
    queryFn: ({ pageParam }) =>
      getPaymentsPage(period, {
        day: day ?? undefined,
        money,
        bankCode: account ? undefined : bank?.code,
        bankAccountId: account?.id,
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
  const { refetch: refetchAccounts } = accountsQuery;
  useFocusEffect(
    useCallback(() => {
      void refetch();
      void refetchSummary();
      void refetchFailed();
      void refetchAccounts();
    }, [refetch, refetchSummary, refetchFailed, refetchAccounts])
  );

  if (query.isPending) return <LoadingView screenTitle={t('transactions.title')} />;
  if (query.isError && !query.data && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void refetch()} />;
  }

  const accountById = new Map((accountsQuery.data ?? []).map((a) => [a.id, a]));
  const nameOfAccount = (id: string | null | undefined) => {
    const found = id ? accountById.get(id) : undefined;
    if (!found) return null;
    return accountName(found, banks.find((b) => b.code === found.bankCode)?.accounts ?? []);
  };
  const bankName = (code: string) => banks.find((b) => b.code === code)?.name ?? code;

  const needle = search.trim().toLowerCase();
  const matches = (...fields: (string | null | undefined)[]) =>
    !needle || fields.some((f) => f?.toLowerCase().includes(needle));

  const visible = showFailed
    ? []
    : (query.data?.pages.flat() ?? []).filter((p) =>
        matches(p.label, p.waiterName, p.recordedBy, p.bankCode)
      );
  // One chosen day, or Today, has no headers (the subtitle already says the day).
  const rows: ListRow[] =
    day || period === 'today'
      ? visible.map((payment) => ({ kind: 'pay', key: payment.id, payment }))
      : withDayHeaders(visible, t);
  const failedChecks = (failedQuery.data ?? []).filter((c) =>
    matches(c.label, c.checkedBy, c.bankCode, c.reference)
  );
  const summary = summaryQuery.data;
  const receipts = summary?.accounts ?? [];
  const accountTotals = (id: string) => {
    const found = receipts.find((r) => r.bankAccountId === id);
    return { totalEtb: found?.totalEtb ?? 0, count: found?.count ?? 0 };
  };
  const bankTotals = (code: string) =>
    receipts
      .filter((r) => r.bankCode === code)
      .reduce((s, r) => ({ totalEtb: s.totalEtb + r.totalEtb, count: s.count + r.count }), {
        totalEtb: 0,
        count: 0,
      });
  const hero = account
    ? accountTotals(account.id)
    : bank
      ? bankTotals(bank.code)
      : cashOnly
        ? { totalEtb: summary?.cashEtb ?? 0, count: summary?.cashCount ?? 0 }
        : params.method === 'bank'
          ? receipts.reduce(
              (s, r) => ({ totalEtb: s.totalEtb + r.totalEtb, count: s.count + r.count }),
              {
                totalEtb: 0,
                count: 0,
              }
            )
          : { totalEtb: summary?.salesEtb ?? 0, count: summary?.count ?? 0 };
  const heroLabel = cashOnly
    ? t('transactions.heroCash')
    : day
      ? t('transactions.hero_day', { date: dateLabel })
      : t(`transactions.hero_${period}`);

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  };
  const methodLabel = bank
    ? account
      ? `${bank.name} · ${nameOfAccount(account.id) ?? ''}`
      : bank.name
    : money
      ? t(methodKey(money))
      : t('history.method.all');

  const download = async () => {
    setDownloading(true);
    try {
      // The statement covers the whole period, not only the rows scrolled so far.
      const all = await getPaymentsPage(period, {
        day: day ?? undefined,
        money,
        bankCode: account ? undefined : bank?.code,
        bankAccountId: account?.id,
        limit: STATEMENT_MAX,
      });
      await sharePdf(
        buildStatement(t, all, methodLabel, day ? dateLabel : t(`period.${period}`), businessName)
      );
    } catch {
      Alert.alert(t('common.error'), t('transactions.downloadFailed'));
    } finally {
      setDownloading(false);
    }
  };

  const choose = (next: { method?: string; bank?: string; account?: string }) =>
    router.setParams({ method: next.method, bank: next.bank, account: next.account });
  const isAll = !params.method && !bank;

  const header = (
    <View className="gap-3 pb-3">
      {searching ? (
        <View className="px-4">
          <GlassCard radius={22} className="h-12 flex-row items-center gap-2 px-4">
            <Search size={18} color={colors.muted} strokeWidth={2.2} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t('transactions.searchPlaceholder')}
              placeholderTextColor={colors.muted}
              autoFocus
              returnKeyType="search"
              accessibilityLabel={t('transactions.search')}
              className="h-12 flex-1 text-base text-text"
            />
          </GlassCard>
        </View>
      ) : null}

      <View className="px-4">
        <Segmented
          options={periods.map((p) => ({ value: p, label: t(`period.${p}`) }))}
          value={day ? ('' as Period) : period}
          onChange={(p) => router.setParams({ period: p, day: '' })}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
        accessibilityRole="radiogroup"
      >
        <FilterChip label={t('history.method.all')} selected={isAll} onPress={() => choose({})} />
        {banks.map((b) => (
          <FilterChip
            key={b.code}
            label={
              b.accounts.length >= 2
                ? t('transactions.bankCount', { bank: b.name, count: b.accounts.length })
                : b.name
            }
            selected={bank?.code === b.code}
            onPress={() => choose({ bank: b.code })}
          />
        ))}
        <FilterChip
          label={t('history.method.cash')}
          selected={cashOnly}
          onPress={() => choose({ method: 'cash' })}
        />
        <FilterChip
          label={t('transactions.problems')}
          selected={showFailed}
          onPress={() => choose({ method: 'failed' })}
        />
      </ScrollView>

      {showAccounts ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}
          accessibilityRole="radiogroup"
        >
          {bank.accounts.map((a) => {
            const totals = accountTotals(a.id);
            const selected = account?.id === a.id;
            return (
              <AccountCard
                key={a.id}
                name={accountName(a, bank.accounts)}
                totalEtb={totals.totalEtb}
                count={totals.count}
                selected={selected}
                // Tapping the chosen account again shows the whole bank.
                onPress={() => choose({ bank: bank.code, account: selected ? undefined : a.id })}
              />
            );
          })}
        </ScrollView>
      ) : null}

      {showFailed ? null : (
        <HeroCard className="mx-4 flex-row items-center gap-3 px-5 py-4">
          <View className="min-w-0 flex-1">
            <Text font="bold" tone="inverse" className="text-[13px] uppercase opacity-90">
              {heroLabel}
            </Text>
            <MoneyText
              value={hero.totalEtb}
              tone="inverse"
              font="heading"
              className="text-[32px]"
              numberOfLines={1}
              adjustsFontSizeToFit
            />
          </View>
          <View className="h-8 justify-center rounded-full border border-white/40 bg-white/20 px-3">
            <Text font="bold" tone="inverse" className="text-sm">
              {t('transactions.payments', { count: hero.count })}
            </Text>
          </View>
        </HeroCard>
      )}
    </View>
  );

  const titleOf = (code: string | null | undefined, accountId: string | null | undefined) => {
    if (!code) return t('transactions.cashRow');
    const name = nameOfAccount(accountId);
    return name
      ? t('transactions.toAccount', { bank: bankName(code), name })
      : t('transactions.toBank', { bank: bankName(code) });
  };

  const footer = (
    <View className="gap-3 px-4 pb-6 pt-3">
      {isFetchingNextPage ? (
        <ActivityIndicator color={g.primary} accessibilityLabel={t('loading.title')} />
      ) : null}
      {!showFailed && visible.length > 0 ? (
        <GhostButton
          label={t('history.download')}
          icon={Download}
          onPress={() => {
            if (!downloading) void download();
          }}
        />
      ) : null}
    </View>
  );

  return (
    <ScreenBg>
      <SafeAreaView edges={['top']} className="flex-1">
        <ScreenHeader
          title={t('transactions.title')}
          subtitle={dateLabel}
          right={
            <View className="flex-row gap-2">
              <GlassCard
                radius={22}
                onPress={() => {
                  if (searching) setSearch('');
                  setSearching(!searching);
                }}
                accessibilityRole="button"
                accessibilityLabel={
                  searching ? t('transactions.closeSearch') : t('transactions.search')
                }
                className="h-11 w-11 items-center justify-center"
              >
                {searching ? (
                  <X size={20} color={colors.text} strokeWidth={2.2} />
                ) : (
                  <Search size={20} color={colors.text} strokeWidth={2.2} />
                )}
              </GlassCard>
              <CalendarButton day={day ? shownDate : null} onPress={() => setSheet('period')} />
            </View>
          }
        />

        {showFailed ? (
          <FlatList
            data={failedChecks}
            keyExtractor={(c) => c.id}
            ListHeaderComponent={header}
            ListFooterComponent={footer}
            renderItem={({ item, index }) => (
              <View className="px-4">
                <FailedCheckRow
                  check={item}
                  title={titleOf(item.bankCode, null)}
                  showDate={!day && period !== 'today'}
                  position={positionAt(
                    failedChecks.map(() => ({ kind: 'pay' })),
                    index
                  )}
                />
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
            ListFooterComponent={footer}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            renderItem={({ item, index }) =>
              item.kind === 'day' ? (
                <Text
                  font="bold"
                  tone="muted"
                  className="px-5 pb-1.5 pt-3 text-[13px] uppercase"
                  accessibilityRole="header"
                >
                  {item.label}
                </Text>
              ) : (
                <View className="px-4">
                  <PaymentRow
                    position={positionAt(rows, index)}
                    payment={item.payment}
                    title={titleOf(item.payment.bankCode, item.payment.bankAccountId)}
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

        <CalendarSheet
          key={`${sheet}-${day}`}
          visible={sheet === 'period'}
          period={period}
          day={day}
          onPeriod={(p) => router.setParams({ period: p, day: '' })}
          onDay={(d) => router.setParams({ day: d })}
          onClose={() => setSheet(null)}
        />
      </SafeAreaView>
    </ScreenBg>
  );
}
