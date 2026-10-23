import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarDays, Download } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { LoadingView } from '@/components/ui/LoadingView';
import { MoneyText } from '@/components/ui/MoneyText';
import { NoConnection } from '@/components/ui/NoConnection';
import { OptionSheet } from '@/components/ui/OptionSheet';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { sharePdf } from '@/lib/export';
import { syncPayments, payMethods, paymentsKey, type PayMethod } from '@/lib/history';
import { isPeriod, periods, type Period } from '@/lib/period';
import { failedChecksKey, getFailedChecks } from '@/lib/verification';
import { useSession } from '@/store/session';
import { colors } from '@/theme/tokens';

import { methodKey } from './methods';
import { PaymentRow } from './PaymentRow';
import { FailedCheckRow } from './FailedCheckRow';
import { buildStatement } from './statement';

const isMethod = (value: unknown): value is PayMethod =>
  typeof value === 'string' && (payMethods as string[]).includes(value);

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
  const params = useLocalSearchParams<{ method?: string; period?: string }>();
  const period: Period = isPeriod(params.period) ? params.period : 'today';
  const method = isMethod(params.method) ? params.method : null;
  // "Failed" lists bank receipt checks that did not verify instead of payments.
  const showFailed = params.method === 'failed';
  const [sheet, setSheet] = useState<'period' | null>(null);
  const [downloading, setDownloading] = useState(false);

  const query = useQuery({ queryKey: paymentsKey(period), queryFn: () => syncPayments(period) });
  const failedQuery = useQuery({
    queryKey: failedChecksKey(period),
    queryFn: () => getFailedChecks(period),
  });
  const { refetch } = query;
  const { refetch: refetchFailed } = failedQuery;
  useFocusEffect(
    useCallback(() => {
      void refetch();
      void refetchFailed();
    }, [refetch, refetchFailed])
  );

  if (query.isPending) return <LoadingView screenTitle={t('transactions.title')} />;
  if (query.isError && !query.data && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void refetch()} />;
  }

  const all = query.data ?? [];
  const visible = showFailed ? [] : method ? all.filter((p) => p.method === method) : all;
  const failedChecks = failedQuery.data ?? [];
  const salesTotal = all.reduce((sum, p) => sum + p.salesEtb, 0);
  const methodLabel = method ? t(methodKey(method)) : t('history.method.all');

  const download = async () => {
    setDownloading(true);
    try {
      await sharePdf(buildStatement(t, visible, methodLabel, t(`period.${period}`), businessName));
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
          {t(`history.summary_${period}`, { count: all.length })}
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
            count={all.length}
            selected={!method && !showFailed}
            onPress={() => router.setParams({ method: undefined })}
          />
          {payMethods.map((m) => (
            <MethodChip
              key={m}
              label={t(methodKey(m))}
              count={all.filter((p) => p.method === m).length}
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

      {showFailed ? (
        <FlatList
          data={failedChecks}
          keyExtractor={(c) => c.id}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: 12 }}
          ItemSeparatorComponent={() => <View className="h-2" />}
          renderItem={({ item }) => (
            <View className="px-4">
              <FailedCheckRow check={item} showDate={period !== 'today'} />
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
          data={visible}
          keyExtractor={(p) => p.id}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: 12 }}
          ItemSeparatorComponent={() => <View className="h-2" />}
          renderItem={({ item }) => (
            <View className="px-4">
              <PaymentRow
                payment={item}
                showDate={period !== 'today'}
                onPress={() =>
                  router.push({ pathname: '/transaction/[id]', params: { id: item.id } })
                }
              />
            </View>
          )}
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

      <OptionSheet
        visible={sheet === 'period'}
        title={t('period.choose')}
        options={periods.map((p) => ({ value: p, label: t(`period.${p}`) }))}
        selected={period}
        onSelect={(p) => router.setParams({ period: p })}
        onClose={() => setSheet(null)}
      />
    </SafeAreaView>
  );
}
