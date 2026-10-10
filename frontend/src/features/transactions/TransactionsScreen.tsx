import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarDays, Download, SlidersHorizontal } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MoneyText } from '@/components/ui/MoneyText';
import { Button } from '@/components/ui/Button';
import { LoadingView } from '@/components/ui/LoadingView';
import { OptionSheet } from '@/components/ui/OptionSheet';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { findAccount, getBankAccounts } from '@/lib/mock/bankAccounts';
import { getTransactions, type TransactionStatus } from '@/lib/mock/transactions';
import { sharePdf } from '@/lib/export';
import { isPeriod, periods, type Period } from '@/lib/period';
import { useSession } from '@/store/session';
import { colors } from '@/theme/tokens';

import { buildStatement } from './statement';
import { TransactionRow } from './TransactionRow';

type StatusFilter = TransactionStatus | 'all';
const statusFilters: StatusFilter[] = ['all', 'verified', 'pending', 'mismatch', 'duplicate'];

function BankChip({
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

export default function TransactionsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const businessName = useSession((s) => s.user?.businessName ?? '');
  const params = useLocalSearchParams<{ accountId?: string; period?: string }>();
  const period: Period = isPeriod(params.period) ? params.period : 'today';
  const account = params.accountId ? findAccount(params.accountId) : null;
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sheet, setSheet] = useState<'period' | 'status' | null>(null);
  const [downloading, setDownloading] = useState(false);

  const { data: all, isPending } = useQuery({
    queryKey: ['transactions', period],
    queryFn: () => getTransactions({ period }),
  });
  const { data: accounts } = useQuery({ queryKey: ['bank-accounts'], queryFn: getBankAccounts });

  if (isPending || !all || !accounts) return <LoadingView />;

  const verifiedAll = all.filter((tx) => tx.status === 'verified');
  const inBank = account ? all.filter((tx) => tx.accountId === account.id) : all;
  const bankVerifiedTotal = inBank
    .filter((tx) => tx.status === 'verified')
    .reduce((sum, tx) => sum + tx.receivedAmount, 0);
  const visible = status === 'all' ? inBank : inBank.filter((tx) => tx.status === status);

  const selectBank = (accountId?: string) => router.setParams({ accountId });

  const download = async () => {
    setDownloading(true);
    try {
      await sharePdf(
        buildStatement(
          t,
          visible,
          account?.shortName ?? t('transactions.allBanks'),
          t(`period.${period}`),
          businessName
        )
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
          {t(`transactions.summary_${period}`, { count: verifiedAll.length })}
        </Text>
        <MoneyText
          value={verifiedAll.reduce((sum, tx) => sum + tx.receivedAmount, 0)}
          tone="inverse"
          className="text-[32px]"
          numberOfLines={1}
          adjustsFontSizeToFit
        />
      </View>

      <View className="pb-2 pt-3">
        <Text font="bold" tone="muted" className="mb-1.5 px-4 text-[15px]">
          {t('transactions.chooseBank')}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
          accessibilityRole="radiogroup"
        >
          <BankChip
            label={t('transactions.allBanks')}
            count={all.length}
            selected={!account}
            onPress={() => selectBank(undefined)}
          />
          {accounts.map((a) => (
            <BankChip
              key={a.id}
              label={a.shortName}
              count={all.filter((tx) => tx.accountId === a.id).length}
              selected={account?.id === a.id}
              onPress={() => selectBank(a.id)}
            />
          ))}
        </ScrollView>
      </View>

      <View className="flex-row items-center justify-between gap-2 px-4 pb-2 pt-1">
        <Text font="bold" className="flex-1 text-base">
          {account?.bankName ?? t('transactions.allBanks')} ·{' '}
          <MoneyText value={bankVerifiedTotal} font="bold" tone="link" className="text-base" />
        </Text>
        <Pressable
          onPress={() => setSheet('status')}
          accessibilityRole="button"
          className={`h-11 flex-row items-center gap-1.5 rounded-[22px] border-2 px-3.5 ${
            status === 'all' ? 'border-borderStrong bg-surface' : 'border-primary bg-primarySoft'
          }`}
        >
          <SlidersHorizontal size={18} color={colors.text} strokeWidth={2.2} />
          <Text font="bold" className="text-[15px]">
            {status === 'all' ? t('transactions.filter') : t(`status.${status}`)}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScreenHeader
        title={t('transactions.title')}
        onBack={() => router.navigate('/home')}
        right={
          <Pressable
            onPress={() => setSheet('period')}
            accessibilityRole="button"
            accessibilityLabel={t('period.choose')}
            className="h-11 w-11 items-center justify-center rounded-full active:bg-border"
          >
            <CalendarDays size={24} color={colors.text} strokeWidth={2} />
          </Pressable>
        }
      />

      <FlatList
        data={visible}
        keyExtractor={(tx) => tx.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 12 }}
        ItemSeparatorComponent={() => <View className="h-2" />}
        renderItem={({ item }) => (
          <View className="px-4">
            <TransactionRow
              transaction={item}
              showDate={period !== 'today'}
              onPress={() =>
                router.push({ pathname: '/transaction/[id]', params: { id: item.id } })
              }
            />
          </View>
        )}
        ListEmptyComponent={
          <Text tone="muted" className="px-6 pt-10 text-center text-lg">
            {t('transactions.empty')}
          </Text>
        }
      />

      <View className="px-4 py-2.5">
        <Button
          label={
            account
              ? t('transactions.downloadBank', { bank: account.shortName })
              : t('transactions.downloadAll')
          }
          icon={Download}
          variant="outline"
          size="md"
          disabled={downloading || visible.length === 0}
          onPress={download}
        />
      </View>

      <OptionSheet
        visible={sheet === 'period'}
        title={t('period.choose')}
        options={periods.map((p) => ({ value: p, label: t(`period.${p}`) }))}
        selected={period}
        onSelect={(p) => router.setParams({ period: p })}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'status'}
        title={t('transactions.filterTitle')}
        options={statusFilters.map((s) => ({
          value: s,
          label: s === 'all' ? t('transactions.allStatuses') : t(`status.${s}`),
        }))}
        selected={status}
        onSelect={setStatus}
        onClose={() => setSheet(null)}
      />
    </SafeAreaView>
  );
}
