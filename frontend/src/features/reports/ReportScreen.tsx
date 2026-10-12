import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatMoney, MoneyText } from '@/components/ui/MoneyText';
import { Button } from '@/components/ui/Button';
import { LoadingView } from '@/components/ui/LoadingView';
import { NoConnection } from '@/components/ui/NoConnection';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { methodIcon, methodKey } from '@/features/transactions/methods';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { shareCsv, sharePdf, type ExportTable } from '@/lib/export';
import { getPaymentsReport, reportKey, type PaymentsReport } from '@/lib/history';
import { periods, type Period } from '@/lib/period';
import { useSession } from '@/store/session';
import { useBrandColors } from '@/store/theme';
import { colors } from '@/theme/tokens';

type Row = PaymentsReport['rows'][number];

function PeriodChip({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      className={`h-[46px] justify-center rounded-[23px] px-[18px] ${
        selected ? 'bg-primary' : 'border-2 border-borderStrong bg-surface'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <Text font="bold" tone={selected ? 'inverse' : 'default'} className="text-base">
        {label}
      </Text>
    </Pressable>
  );
}

function MethodCard({ row, onPress }: { row: Row; onPress: () => void }) {
  const brand = useBrandColors();
  const { t } = useTranslation();
  const Icon = methodIcon[row.method];
  const name = t(methodKey(row.method));
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${t('history.report.open', { method: name })}. ${formatMoney(row.totalEtb)}, ${t('history.report.payments', { count: row.count, share: row.share })}`}
      className="rounded-[18px] border-[1.5px] border-border bg-surface px-3.5 py-3 active:bg-background"
    >
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-[12px] bg-primaryTile">
          <Icon size={22} color={brand.primary} strokeWidth={2.2} />
        </View>
        <View className="flex-1">
          <Text font="bold" className="text-[17px]" numberOfLines={1}>
            {name}
          </Text>
          <Text tone="muted" className="text-sm">
            {t('history.report.payments', { count: row.count, share: row.share })}
          </Text>
        </View>
        <View className="items-end">
          <MoneyText value={row.totalEtb} showCurrency={false} className="text-lg" />
          <Text font="bold" className="text-sm">
            {t('common.etb')}
          </Text>
        </View>
        <ChevronRight size={22} color={colors.muted} strokeWidth={2} />
      </View>
      <View className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-neutralBg">
        <View className="h-full bg-primary" style={{ width: `${row.share}%` }} />
      </View>
    </Pressable>
  );
}

function buildReportTable(
  t: TFunction,
  report: PaymentsReport,
  periodLabel: string,
  businessName: string
): ExportTable {
  return {
    title: t('history.report.fileTitle'),
    subtitle: `${businessName} · ${periodLabel}`,
    columns: [
      t('history.report.columns.method'),
      t('history.report.columns.payments'),
      t('history.report.columns.share'),
      t('history.report.columns.amount'),
    ],
    rows: report.rows.map((row) => [
      t(methodKey(row.method)),
      String(row.count),
      `${row.share}%`,
      formatMoney(row.totalEtb, false),
    ]),
    footer: `${t('history.total', { amount: formatMoney(report.totalEtb, false) })} · ${t('history.report.tips', { amount: formatMoney(report.tipsEtb, false) })}`,
  };
}

/** Sales by payment method (cash, bank, cash + bank). Tips are shown apart, not as sales. */
export default function ReportScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const businessName = useSession((s) => s.user?.businessName ?? '');
  const [period, setPeriod] = useState<Period>('today');
  const [downloading, setDownloading] = useState(false);
  const query = useQuery({ queryKey: reportKey(period), queryFn: () => getPaymentsReport(period) });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );
  const report = query.data;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/home'));

  const download = async (kind: 'pdf' | 'csv') => {
    if (!report) return;
    setDownloading(true);
    try {
      const table = buildReportTable(t, report, t(`period.${period}`), businessName);
      if (kind === 'pdf') await sharePdf(table);
      else await shareCsv(`sales-report-${period}.csv`, table);
    } catch {
      Alert.alert(t('common.error'), t('transactions.downloadFailed'));
    } finally {
      setDownloading(false);
    }
  };

  if (query.isError && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void refetch()} />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader title={t('history.report.title')} onBack={goBack} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="max-h-14 flex-grow-0"
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 10 }}
        accessibilityRole="radiogroup"
      >
        {periods.map((p) => (
          <PeriodChip
            key={p}
            label={t(`period.${p}`)}
            selected={period === p}
            onPress={() => setPeriod(p)}
          />
        ))}
        <PeriodChip label={t('period.custom')} selected={false} disabled onPress={() => {}} />
      </ScrollView>

      {query.isPending ? (
        <LoadingView />
      ) : !report ? (
        <Text font="semibold" className="px-6 pt-10 text-center text-lg">
          {t(errorMessageKey(query.error))}
        </Text>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={{ paddingBottom: 12 }}
            showsVerticalScrollIndicator={false}
          >
            <View className="mx-4 rounded-card bg-primary px-5 py-3.5">
              <Text font="semibold" tone="inverse" className="text-[15px]">
                {t('history.report.totalAll', { count: report.count })}
              </Text>
              <MoneyText
                value={report.totalEtb}
                tone="inverse"
                className="text-[34px]"
                numberOfLines={1}
                adjustsFontSizeToFit
              />
              <Text font="semibold" tone="inverse" className="text-sm opacity-90">
                {t('history.report.tips', { amount: formatMoney(report.tipsEtb, false) })}
              </Text>
            </View>

            <Text font="heading" className="px-4 pb-2 pt-3.5 text-lg" accessibilityRole="header">
              {t('history.report.byMethod')}
            </Text>
            <View className="gap-2 px-4">
              {report.rows.map((row) => (
                <MethodCard
                  key={row.method}
                  row={row}
                  onPress={() =>
                    router.navigate({
                      pathname: '/transactions',
                      params: { method: row.method, period },
                    })
                  }
                />
              ))}
            </View>
          </ScrollView>

          <View className="flex-row gap-2.5 px-4 py-2.5">
            <View className="flex-1">
              <Button
                label={t('report.downloadPdf')}
                size="md"
                disabled={downloading}
                onPress={() => download('pdf')}
              />
            </View>
            <View className="flex-1">
              <Button
                label={t('report.downloadCsv')}
                variant="outline"
                size="md"
                disabled={downloading}
                onPress={() => download('csv')}
              />
            </View>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
