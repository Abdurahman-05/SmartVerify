import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { HandCoins } from 'lucide-react-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { GlassCard } from '@/components/ui/GlassCard';
import { useGlass } from '@/components/ui/glassTokens';
import { HeroCard } from '@/components/ui/HeroCard';
import { LoadingView } from '@/components/ui/LoadingView';
import { formatMoney } from '@/components/ui/MoneyText';
import { NoConnection } from '@/components/ui/NoConnection';
import { Text } from '@/components/ui/Text';
import { isNetworkError } from '@/lib/errors';
import { formatTime } from '@/lib/format';
import { getPaymentsPage, paymentsPagesKey } from '@/lib/history';
import { getTips, tipsKey } from '@/lib/tips';
import { colors } from '@/theme/tokens';

/** "My tips today": tips come only from bank payments, and the owner pays them out. */
export default function TipsPanel() {
  const g = useGlass();
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: tipsKey('today', 'mine'),
    queryFn: () => getTips('today', { mine: true }),
  });
  // The paid bill's total, for "Bill 940 · paid 990".
  const paymentsQuery = useQuery({
    queryKey: paymentsPagesKey('today'),
    queryFn: () => getPaymentsPage('today', { limit: 100 }),
  });
  const { refetch } = query;
  const { refetch: refetchPayments } = paymentsQuery;
  const reload = useCallback(() => {
    void refetch();
    void refetchPayments();
  }, [refetch, refetchPayments]);
  useFocusEffect(reload);

  if (query.isPending) return <LoadingView />;
  if (query.isError && !query.data && isNetworkError(query.error)) {
    return <NoConnection onRetry={reload} />;
  }
  // No cash tips here: they come only from bank payments.
  const tips = (query.data ?? []).filter((tip) => tip.source !== 'cash');
  const total = tips.reduce((sum, tip) => sum + tip.amount, 0);
  const byBill = new Map((paymentsQuery.data ?? []).map((p) => [p.billId, p]));
  const allPaidOut = tips.length > 0 && tips.every((tip) => tip.paidOut);

  return (
    <ScrollView contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingBottom: 16 }}>
      <HeroCard style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View accessible className="min-w-0 flex-1">
          <Text font="bold" tone="inverse" className="text-sm uppercase">
            {t('tips.todayTitle')}
          </Text>
          <Text font="heading" tone="inverse" className="text-[40px] leading-[48px]">
            {formatMoney(total, false)}{' '}
            <Text font="heading" tone="inverse" className="text-lg">
              {t('common.etb')}
            </Text>
          </Text>
          <Text tone="inverse" className="text-sm">
            {t('tips.bankPayments', { count: tips.length })}
          </Text>
        </View>
        <View
          className="h-14 w-14 items-center justify-center rounded-[18px]"
          style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
        >
          <HandCoins size={28} color="#FFFFFF" strokeWidth={2} />
        </View>
      </HeroCard>

      <View className="flex-row items-center gap-2 px-1">
        <Text font="heading" className="flex-1 text-lg" accessibilityRole="header">
          {t('tips.fromEachTable')}
        </Text>
        {tips.length ? (
          <View
            className="rounded-full px-3 py-1.5"
            style={{ backgroundColor: allPaidOut ? colors.successBg : colors.warnBg }}
          >
            <Text
              font="bold"
              className="text-sm"
              style={{ color: allPaidOut ? colors.successFg : colors.warnFg }}
            >
              {allPaidOut ? t('tips.paidOut') : t('tips.notPaidOut')}
            </Text>
          </View>
        ) : null}
      </View>

      {tips.length === 0 ? (
        <Text tone="muted" className="pt-4 text-center text-lg">
          {t('tips.empty')}
        </Text>
      ) : (
        <GlassCard style={{ paddingHorizontal: 16, paddingVertical: 2 }}>
          {tips.map((item, i) => {
            const number = /\d+/.exec(item.label)?.[0];
            const bill = byBill.get(item.billId);
            const time = `${formatTime(item.createdAt)} · ${t('tips.bank').toLowerCase()}`;
            const title = bill
              ? t('tips.billPaid', {
                  bill: formatMoney(bill.salesEtb, false),
                  paid: formatMoney(bill.salesEtb + item.amount, false),
                })
              : item.label;
            return (
              <View
                key={item.id}
                accessible
                accessibilityLabel={`${item.label}, ${title}, +${formatMoney(item.amount)}, ${time}`}
                className={`flex-row items-center gap-3 py-3 ${i ? 'border-t border-black/[0.07]' : ''}`}
              >
                <View
                  className="h-12 w-12 items-center justify-center rounded-[14px]"
                  style={{ backgroundColor: g.primaryDeep }}
                >
                  {number ? (
                    <>
                      <Text font="bold" tone="inverse" className="text-[10px] uppercase">
                        {t('tips.tableBadge')}
                      </Text>
                      <Text font="heading" tone="inverse" className="text-lg leading-5">
                        {number}
                      </Text>
                    </>
                  ) : (
                    <HandCoins size={22} color="#FFFFFF" strokeWidth={2.2} />
                  )}
                </View>
                <View className="min-w-0 flex-1">
                  <Text font="bold" className="text-base" numberOfLines={1}>
                    {title}
                  </Text>
                  <Text tone="muted" className="text-sm" numberOfLines={1}>
                    {time}
                  </Text>
                </View>
                <Text font="heading" className="text-lg" style={{ color: g.primaryText }}>
                  +{formatMoney(item.amount, false)}
                </Text>
              </View>
            );
          })}
        </GlassCard>
      )}

      <Text tone="muted" className="px-2 text-center text-sm leading-5">
        {t('tips.note')}
      </Text>
    </ScrollView>
  );
}
