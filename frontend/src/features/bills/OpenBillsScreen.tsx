import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Armchair,
  Bike,
  Check,
  ChevronLeft,
  Search,
  ShieldCheck,
  ShoppingBag,
  X,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBackFallback } from '@/hooks/useBackFallback';
import { GhostButton } from '@/components/ui/GhostButton';
import { GlassCard } from '@/components/ui/GlassCard';
import { useGlass } from '@/components/ui/glassTokens';
import { IconTile } from '@/components/ui/IconTile';
import { LoadingView } from '@/components/ui/LoadingView';
import { formatMoney } from '@/components/ui/MoneyText';
import { NoConnection } from '@/components/ui/NoConnection';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { Segmented } from '@/components/ui/Segmented';
import { Text } from '@/components/ui/Text';
import { useSession } from '@/store/session';
import { billsKey, getBills } from '@/lib/bills';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { formatTime } from '@/lib/format';
import { colors } from '@/theme/tokens';

import type { Bill } from './types';

// Design: docs/design/owner/verify-handoff/screens/09-open-bills.png
/** Open bills refresh on their own (bills paid or served by someone else). */
const BILLS_REFRESH_MS = 20_000;

const typeIcon = { dine: Armchair, takeaway: ShoppingBag, delivery: Bike } as const;

/** Served (green, ✓) or still in the kitchen (amber). */
function StatusTag({ bill }: { bill: Bill }) {
  const { t } = useTranslation();
  const served = bill.status === 'paid' || bill.servedStatus === 'served';
  const label =
    bill.status === 'paid' ? t('bills.paid') : served ? t('bills.served') : t('bills.inKitchen');
  return (
    <View
      className="h-7 flex-row items-center gap-1 rounded-[14px] px-2.5"
      style={{ backgroundColor: served ? colors.successBg : colors.warnBg }}
    >
      {served ? <Check size={13} color={colors.successFg} strokeWidth={2.8} /> : null}
      <Text
        font="bold"
        className="text-[13px]"
        style={{ color: served ? colors.successFg : colors.warnFg }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

/** Small round glass button with one icon (search, back). */
function RoundButton({
  icon: Icon,
  label,
  onPress,
}: {
  icon: typeof Search;
  label: string;
  onPress: () => void;
}) {
  return (
    <GlassCard
      radius={22}
      onPress={onPress}
      accessibilityLabel={label}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon size={21} color={colors.text} strokeWidth={2.2} />
    </GlassCard>
  );
}

function BillCard({ bill, onPress }: { bill: Bill; onPress: () => void }) {
  const { t } = useTranslation();
  const g = useGlass();
  const kind =
    bill.type === 'dine'
      ? t('bills.tableTile')
      : bill.type === 'takeaway'
        ? t('bills.takeaway')
        : t('bills.delivery');
  const who =
    bill.type === 'dine'
      ? bill.guests
        ? t('bills.guests', { count: bill.guests })
        : null
      : bill.type === 'takeaway'
        ? bill.customerName
        : bill.area;
  const sub = [who, formatTime(bill.createdAt)].filter(Boolean).join(' · ');
  const name = bill.type === 'dine' ? t('orders.table', { number: bill.tableNo }) : kind;
  return (
    <GlassCard
      onPress={onPress}
      accessibilityLabel={t('bills.openBill', { name, amount: formatMoney(bill.total) })}
      // Half the row each, also when a bill is alone on the last row.
      containerStyle={{ flex: 1, maxWidth: '48.6%' }}
      style={{ padding: 14, gap: 4, minHeight: 150 }}
    >
      <View className="mb-1 flex-row items-start justify-between gap-1">
        <IconTile icon={typeIcon[bill.type]} size={34} radius={11} iconSize={18} />
        <StatusTag bill={bill} />
      </View>
      <Text
        font="bold"
        className="text-[11px] uppercase tracking-[0.8px]"
        style={{ color: colors.muted }}
      >
        {kind}
      </Text>
      <Text font="heading" className="text-[28px] leading-[32px]">
        {bill.type === 'dine' ? bill.tableNo : `#${bill.orderNo}`}
      </Text>
      <Text font="heading" className="text-[17px]" style={{ color: g.primaryText }}>
        {`${formatMoney(bill.total, false)} ${t('common.etb')}`}
      </Text>
      <Text className="text-xs" style={{ color: colors.muted }} numberOfLines={1}>
        {sub}
      </Text>
    </GlassCard>
  );
}

export default function OpenBillsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  useBackFallback('/home');
  // Waiters start on their own tables (they can look at the others); owner and manager look
  // after every table, so they start on All.
  const isWaiter = useSession((s) => s.user?.role === 'waiter');
  const [scope, setScope] = useState<'mine' | 'all'>(isWaiter ? 'mine' : 'all');
  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState('');
  // Home's "N tables waiting" button lists only the dine-in tables.
  const { only } = useLocalSearchParams<{ only?: string }>();

  const query = useQuery({
    queryKey: billsKey(scope),
    queryFn: () => getBills({ mine: scope === 'mine' }),
    refetchInterval: BILLS_REFRESH_MS,
  });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  if (query.isPending) return <LoadingView screenTitle={t('bills.title')} />;
  if (query.isError && !query.data && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void refetch()} />;
  }
  const bills = query.data ?? [];
  const all = only === 'tables' ? bills.filter((b) => b.type === 'dine') : bills;
  // Search by table number, order number, customer name or area.
  const term = search.trim().toLowerCase();
  const shown = term
    ? all.filter((b) =>
        [b.tableNo, b.orderNo, b.customerName, b.area]
          .filter((v) => v !== null && v !== undefined)
          .some((v) => String(v).toLowerCase().includes(term))
      )
    : all;
  const notPaid = all.reduce((sum, b) => sum + b.total, 0);
  const canGoBack = router.canGoBack();

  return (
    <ScreenBackground>
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
          {canGoBack ? (
            <RoundButton
              icon={ChevronLeft}
              label={t('common.back')}
              onPress={() => router.back()}
            />
          ) : null}
          <View className="flex-1">
            <Text font="heading" className="text-[28px] leading-[34px]" accessibilityRole="header">
              {t('bills.title')}
            </Text>
            <Text className="text-sm" style={{ color: colors.muted }} numberOfLines={1}>
              {`${t('bills.notPaidYet')} · ${formatMoney(notPaid, false)} ${t('common.etb')}`}
            </Text>
          </View>
          <RoundButton
            icon={searching ? X : Search}
            label={t(searching ? 'bills.closeSearch' : 'bills.search')}
            onPress={() => {
              setSearching((v) => !v);
              setSearch('');
            }}
          />
        </View>

        {searching ? (
          <View className="px-4 pb-3">
            <GlassCard
              radius={26}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingHorizontal: 16,
                height: 52,
              }}
            >
              <Search size={18} color={colors.muted} strokeWidth={2.2} />
              <TextInput
                autoFocus
                value={search}
                onChangeText={setSearch}
                placeholder={t('bills.searchPlaceholder')}
                placeholderTextColor={colors.placeholder}
                accessibilityLabel={t('bills.search')}
                className="h-full flex-1 font-body text-base text-text"
              />
            </GlassCard>
          </View>
        ) : null}

        <View className="px-4 pb-3">
          <Segmented<'mine' | 'all'>
            options={[
              {
                value: 'mine',
                label:
                  scope === 'mine' ? `${t('bills.myTables')} · ${all.length}` : t('bills.myTables'),
              },
              {
                value: 'all',
                label:
                  scope === 'all'
                    ? `${t('bills.allTables')} · ${all.length}`
                    : t('bills.allTables'),
              },
            ]}
            value={scope}
            onChange={setScope}
          />
        </View>

        <FlatList
          data={shown}
          keyExtractor={(b) => b.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 10 }}
          contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <BillCard
              bill={item}
              onPress={() => router.push({ pathname: '/bills/[id]', params: { id: item.id } })}
            />
          )}
          ListEmptyComponent={
            <Text tone="muted" className="px-4 pt-8 text-center text-lg">
              {query.isError ? t(errorMessageKey(query.error)) : t('bills.empty')}
            </Text>
          }
          ListFooterComponent={
            <View className="gap-3 pt-1">
              <GhostButton
                label={t('bills.verifyWithoutOrder')}
                icon={ShieldCheck}
                onPress={() => router.push('/verify')}
              />
              <Text tone="muted" className="px-2.5 text-center text-sm leading-5">
                {t('bills.listNote')}
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </ScreenBackground>
  );
}
