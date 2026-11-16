import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { Banknote } from 'lucide-react-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { BankBadge } from '@/components/ui/BankBadge';
import { GlassCard } from '@/components/ui/GlassCard';
import { HeroCard, HeroChip } from '@/components/ui/HeroCard';
import { LoadingView } from '@/components/ui/LoadingView';
import { formatMoney } from '@/components/ui/MoneyText';
import { NoConnection } from '@/components/ui/NoConnection';
import { Text } from '@/components/ui/Text';
import { isNetworkError } from '@/lib/errors';
import { formatTime } from '@/lib/format';
import { getPaymentsPage, paymentsPagesKey } from '@/lib/history';
import { getTips, tipsKey } from '@/lib/tips';
import {
  failedChecksKey,
  getFailedChecks,
  getVerifiedChecks,
  verifiedChecksKey,
} from '@/lib/verification';
import { colors } from '@/theme/tokens';

type Tag = 'verified' | 'cash' | 'duplicate';

interface Row {
  id: string;
  /** Bank code, or null for cash. */
  bank: string | null;
  title: string;
  sub: string;
  amount: number;
  tag: Tag;
  at: string;
}

const tagStyle: Record<Tag, { bg: string; fg: string }> = {
  verified: { bg: colors.successBg, fg: colors.successFg },
  cash: { bg: colors.successBg, fg: colors.successFg },
  duplicate: { bg: colors.dangerBg, fg: colors.dangerFg },
};

function RowView({ row, first }: { row: Row; first: boolean }) {
  const { t } = useTranslation();
  const style = tagStyle[row.tag];
  return (
    <View
      accessible
      accessibilityLabel={`${row.title}, ${formatMoney(row.amount)}, ${t(`activity.tag.${row.tag}`)}, ${row.sub}`}
      className={`flex-row items-center gap-3 py-3 ${first ? '' : 'border-t border-black/[0.07]'}`}
    >
      {row.bank ? (
        <BankBadge code={row.bank} size={48} />
      ) : (
        <View
          className="h-12 w-12 items-center justify-center rounded-[14px]"
          style={{ backgroundColor: colors.successBg }}
        >
          <Banknote size={24} color={colors.successFg} strokeWidth={2.2} />
        </View>
      )}
      <View className="min-w-0 flex-1">
        <Text font="bold" className="text-base" numberOfLines={1}>
          {row.title}
        </Text>
        <Text tone="muted" className="text-sm" numberOfLines={1}>
          {row.sub}
        </Text>
      </View>
      <View className="items-end gap-1">
        <Text font="heading" className="text-base">
          {formatMoney(row.amount, false)}
        </Text>
        <View className="rounded-full px-3 py-1" style={{ backgroundColor: style.bg }}>
          <Text font="bold" className="text-sm" style={{ color: style.fg }}>
            {t(`activity.tag.${row.tag}`)}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** Payments part of Activity: today's verified bank receipts, cash bills and duplicate receipts. */
export function ActivityPayments() {
  const { t } = useTranslation();
  const verifiedQuery = useQuery({
    queryKey: verifiedChecksKey('today'),
    queryFn: () => getVerifiedChecks('today'),
  });
  const failedQuery = useQuery({
    queryKey: failedChecksKey('today'),
    queryFn: () => getFailedChecks('today'),
  });
  const paymentsQuery = useQuery({
    queryKey: paymentsPagesKey('today'),
    queryFn: () => getPaymentsPage('today', { limit: 100 }),
  });
  const tipsQuery = useQuery({
    queryKey: tipsKey('today', 'mine'),
    queryFn: () => getTips('today', { mine: true }),
  });
  const { refetch: r1 } = verifiedQuery;
  const { refetch: r2 } = failedQuery;
  const { refetch: r3 } = paymentsQuery;
  const { refetch: r4 } = tipsQuery;
  const retry = useCallback(() => {
    void r1();
    void r2();
    void r3();
    void r4();
  }, [r1, r2, r3, r4]);
  useFocusEffect(retry);

  if (verifiedQuery.isPending || paymentsQuery.isPending) return <LoadingView />;
  const error = verifiedQuery.error ?? paymentsQuery.error;
  if (error && isNetworkError(error)) return <NoConnection onRetry={retry} />;

  const verified = verifiedQuery.data ?? [];
  const payments = paymentsQuery.data ?? [];
  // Tips come only from bank payments.
  const tips = (tipsQuery.data ?? []).filter((tip) => tip.source !== 'cash');
  const byBill = new Map(payments.map((p) => [p.billId, p]));
  const tipByBill = new Map(tips.map((tip) => [tip.billId, tip.amount]));

  const rows: Row[] = [
    ...verified.map((c): Row => {
      const label = c.billId ? byBill.get(c.billId)?.label : undefined;
      const tip = c.billId ? tipByBill.get(c.billId) : undefined;
      const time = formatTime(c.createdAt);
      return {
        id: `v-${c.id}`,
        bank: c.bankCode,
        title: [label, c.payerName].filter(Boolean).join(' · ') || c.bankCode,
        sub: tip ? `${time} · ${t('activity.tip', { amount: formatMoney(tip, false) })}` : time,
        amount: c.expectedAmountEtb,
        tag: 'verified',
        at: c.createdAt,
      };
    }),
    ...payments
      .filter((p) => p.method === 'cash')
      .map((p): Row => ({
        id: `c-${p.id}`,
        bank: null,
        title: `${p.label} · ${t('activity.tag.cash')}`,
        sub: formatTime(p.createdAt),
        amount: p.salesEtb,
        tag: 'cash',
        at: p.createdAt,
      })),
    ...(failedQuery.data ?? [])
      .filter((c) => c.reasons.includes('DUPLICATE'))
      .map((c): Row => ({
        id: `d-${c.id}`,
        bank: c.bankCode,
        title: c.label ?? c.bankCode,
        sub: `${formatTime(c.createdAt)} · ${t('activity.usedBefore')}`,
        amount: c.expectedAmountEtb,
        tag: 'duplicate',
        at: c.createdAt,
      })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const verifiedTotal = verified.reduce((sum, c) => sum + c.expectedAmountEtb, 0);
  const tipsTotal = tips.reduce((sum, tip) => sum + tip.amount, 0);

  return (
    <ScrollView contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingBottom: 16 }}>
      <HeroCard style={{ flexDirection: 'row', gap: 12, padding: 16 }}>
        <HeroChip style={{ flex: 1 }}>
          <Text font="bold" tone="inverse" className="text-sm uppercase">
            {t('activity.iVerified')}
          </Text>
          <Text font="heading" tone="inverse" className="text-[28px] leading-9">
            {verified.length}
          </Text>
          <Text tone="inverse" className="text-sm">
            {formatMoney(verifiedTotal)}
          </Text>
        </HeroChip>
        <HeroChip style={{ flex: 1 }}>
          <Text font="bold" tone="inverse" className="text-sm uppercase">
            {t('activity.myTips')}
          </Text>
          <Text font="heading" tone="inverse" className="text-[28px] leading-9">
            {formatMoney(tipsTotal, false)}
          </Text>
          <Text tone="inverse" className="text-sm">
            {t('activity.bankTables', { count: tips.length })}
          </Text>
        </HeroChip>
      </HeroCard>

      {rows.length === 0 ? (
        <Text tone="muted" className="pt-4 text-center text-lg">
          {t('activity.empty')}
        </Text>
      ) : (
        <GlassCard style={{ paddingHorizontal: 16, paddingVertical: 2 }}>
          {rows.map((row, i) => (
            <RowView key={row.id} row={row} first={i === 0} />
          ))}
        </GlassCard>
      )}
    </ScrollView>
  );
}
