import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { CircleCheck } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingView } from '@/components/ui/LoadingView';
import { MoneyText } from '@/components/ui/MoneyText';
import { NoConnection } from '@/components/ui/NoConnection';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { Pill } from '@/features/orders/Pill';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { formatDay, formatTime } from '@/lib/format';
import { periods, type Period } from '@/lib/period';
import {
  failedChecksKey,
  getFailedChecks,
  getVerifiedChecks,
  verifiedChecksKey,
  type VerifiedCheck,
} from '@/lib/verification';
import { colors } from '@/theme/tokens';

import { FailedCheckRow } from './FailedCheckRow';

function VerifiedRow({ check, showDate }: { check: VerifiedCheck; showDate: boolean }) {
  const { t } = useTranslation();
  const when = showDate
    ? `${formatDay(check.createdAt, false)}, ${formatTime(check.createdAt)}`
    : formatTime(check.createdAt);
  return (
    <View
      accessible
      accessibilityLabel={`${check.reference}, ${t('history.receipts.verifiedTag')}, ${check.checkedBy}, ${when}`}
      className="flex-row items-center gap-3 rounded-[18px] border-[1.5px] border-border bg-surface p-3"
    >
      <View className="h-12 w-12 items-center justify-center rounded-[14px] bg-successBg">
        <CircleCheck size={24} color={colors.successFg} strokeWidth={2.2} />
      </View>
      <View className="min-w-0 flex-1">
        <Text font="bold" className="text-[17px]" numberOfLines={1}>
          {check.payerName ?? check.reference}
        </Text>
        <Text tone="muted" className="text-sm" numberOfLines={1}>
          {check.bankCode} · {check.reference}
        </Text>
        <Text tone="muted" className="text-sm" numberOfLines={1}>
          {check.checkedBy} · {when}
        </Text>
      </View>
      <View className="items-end gap-0.5">
        <MoneyText value={check.amountEtb} font="bold" className="text-lg" />
        <Text font="bold" className="text-sm" style={{ color: colors.successFg }}>
          {t('history.receipts.verifiedTag')}
        </Text>
      </View>
    </View>
  );
}

/** Normal Verify history: receipts that verified, and checks that failed (kept 4 months). */
export default function ReceiptHistoryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>('today');
  const [showFailed, setShowFailed] = useState(false);

  const verified = useQuery({
    queryKey: verifiedChecksKey(period),
    queryFn: () => getVerifiedChecks(period),
  });
  const failed = useQuery({
    queryKey: failedChecksKey(period),
    queryFn: () => getFailedChecks(period),
  });
  const { refetch } = verified;
  const { refetch: refetchFailed } = failed;
  useFocusEffect(
    useCallback(() => {
      void refetch();
      void refetchFailed();
    }, [refetch, refetchFailed])
  );

  if (verified.isPending) return <LoadingView screenTitle={t('transactions.title')} />;
  if (verified.isError && !verified.data && isNetworkError(verified.error)) {
    return <NoConnection onRetry={() => void refetch()} />;
  }

  const verifiedList = verified.data ?? [];
  const failedList = failed.data ?? [];
  const total = verifiedList.reduce((sum, c) => sum + c.amountEtb, 0);
  const showDate = period !== 'today';
  const loadError = showFailed ? failed : verified;

  const header = (
    <View className="gap-3 pb-3">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
        accessibilityRole="radiogroup"
      >
        {periods.map((p) => (
          <Pill
            key={p}
            label={t(`period.${p}`)}
            selected={period === p}
            onPress={() => setPeriod(p)}
          />
        ))}
      </ScrollView>
      <View className="mx-4 rounded-card bg-primary px-5 py-3">
        <Text font="semibold" tone="inverse" className="text-[15px]">
          {t('history.receipts.summary', { count: verifiedList.length })}
        </Text>
        <MoneyText value={total} tone="inverse" className="text-[32px]" numberOfLines={1} />
      </View>
      <View className="flex-row gap-2 px-4" accessibilityRole="radiogroup">
        <Pill
          label={t('history.receipts.verified', { count: verifiedList.length })}
          selected={!showFailed}
          onPress={() => setShowFailed(false)}
        />
        <Pill
          label={t('history.receipts.failed', { count: failedList.length })}
          selected={showFailed}
          onPress={() => setShowFailed(true)}
        />
      </View>
      <Text tone="muted" className="px-4 text-sm">
        {t('history.receipts.kept')}
      </Text>
    </View>
  );

  const empty = (
    <Text tone="muted" className="px-6 pt-10 text-center text-lg">
      {loadError.isError
        ? `${t('history.loadFailed')} ${t(errorMessageKey(loadError.error))}`
        : t(showFailed ? 'history.failed.empty' : 'history.receipts.empty')}
    </Text>
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScreenHeader title={t('transactions.title')} onBack={() => router.navigate('/home')} />
      {showFailed ? (
        <FlatList
          data={failedList}
          keyExtractor={(c) => c.id}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: 16 }}
          ItemSeparatorComponent={() => <View className="h-2" />}
          renderItem={({ item }) => (
            <View className="px-4">
              <FailedCheckRow check={item} showDate={showDate} />
            </View>
          )}
          ListEmptyComponent={empty}
        />
      ) : (
        <FlatList
          data={verifiedList}
          keyExtractor={(c) => c.id}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: 16 }}
          ItemSeparatorComponent={() => <View className="h-2" />}
          renderItem={({ item }) => (
            <View className="px-4">
              <VerifiedRow check={item} showDate={showDate} />
            </View>
          )}
          ListEmptyComponent={empty}
        />
      )}
    </SafeAreaView>
  );
}
