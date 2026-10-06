import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatMoney, MoneyText } from '@/components/ui/MoneyText';
import { BankBadge } from '@/components/ui/BankBadge';
import { Button } from '@/components/ui/Button';
import { LoadingView } from '@/components/ui/LoadingView';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { getBankReport, type BankReport, type BankReportRow } from '@/lib/mock/transactions';
import { shareCsv, sharePdf, type ExportTable } from '@/lib/export';
import { periods, type Period } from '@/lib/period';
import { useSession } from '@/store/session';
import { colors } from '@/theme/tokens';

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

function BankCard({ row, onPress }: { row: BankReportRow; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${t('report.openBank', { bank: row.account.shortName })}. ${formatMoney(row.total)}, ${t('report.payments', { count: row.count, share: row.share })}`}
      className="rounded-[18px] border-[1.5px] border-border bg-surface px-3.5 py-3 active:bg-background"
    >
      <View className="flex-row items-center gap-3">
        <BankBadge code={row.account.bankCode} size={44} />
        <View className="flex-1">
          <Text font="bold" className="text-[17px]" numberOfLines={1}>
            {row.account.bankName}
          </Text>
          <Text tone="muted" className="text-sm">
            {t('report.payments', { count: row.count, share: row.share })}
          </Text>
        </View>
        <View className="items-end">
          <MoneyText value={row.total} showCurrency={false} className="text-lg" />
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
  report: BankReport,
  periodLabel: string,
  businessName: string
): ExportTable {
  return {
    title: t('report.fileTitle'),
    subtitle: `${businessName} · ${periodLabel}`,
    columns: [
      t('report.columns.bank'),
      t('report.columns.payments'),
      t('report.columns.share'),
      t('report.columns.amount'),
    ],
    rows: report.rows.map((row) => [
      row.account.bankName,
      String(row.count),
      `${row.share}%`,
      formatMoney(row.total, false),
    ]),
    footer: t('transactions.totalVerified', { amount: formatMoney(report.total, false) }),
  };
}

export default function ReportScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const businessName = useSession((s) => s.user?.businessName ?? '');
  const [period, setPeriod] = useState<Period>('today');
  const [downloading, setDownloading] = useState(false);
  const { data: report, isPending } = useQuery({
    queryKey: ['report', period],
    queryFn: () => getBankReport(period),
  });

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/home'));

  const download = async (kind: 'pdf' | 'csv') => {
    if (!report) return;
    setDownloading(true);
    try {
      const table = buildReportTable(t, report, t(`period.${period}`), businessName);
      if (kind === 'pdf') await sharePdf(table);
      else await shareCsv(`report-by-bank-${period}.csv`, table);
    } catch {
      Alert.alert(t('common.error'), t('transactions.downloadFailed'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader title={t('report.title')} onBack={goBack} />

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

      {isPending || !report ? (
        <LoadingView />
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
            <View className="mx-4 rounded-card bg-primary px-5 py-3.5">
              <Text font="semibold" tone="inverse" className="text-[15px]">
                {t('report.totalAll')}
              </Text>
              <MoneyText
                value={report.total}
                tone="inverse"
                className="text-[34px]"
                numberOfLines={1}
                adjustsFontSizeToFit
              />
            </View>

            <Text font="heading" className="px-4 pb-2 pt-3.5 text-lg" accessibilityRole="header">
              {t('report.byBank')}
            </Text>
            <View className="gap-2 px-4">
              {report.rows.map((row) => (
                <BankCard
                  key={row.account.id}
                  row={row}
                  onPress={() =>
                    router.navigate({
                      pathname: '/transactions',
                      params: { accountId: row.account.id, period },
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
