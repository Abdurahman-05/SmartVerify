import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { LoadingView } from '@/components/ui/LoadingView';
import { formatMoney, MoneyText } from '@/components/ui/MoneyText';
import { NoConnection } from '@/components/ui/NoConnection';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { isNetworkError } from '@/lib/errors';
import { formatDay, formatTime } from '@/lib/format';
import { getPayment, paymentKey } from '@/lib/history';
import { useBrandColors } from '@/store/theme';

import { methodIcon, methodKey } from './methods';

function DetailRow({
  label,
  children,
  last,
}: {
  label: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <View
      accessible
      className={`flex-row items-center justify-between gap-3 py-[13px] ${last ? '' : 'border-b-[1.5px] border-divider'}`}
    >
      <Text tone="muted" className="flex-1 text-[15px]">
        {label}
      </Text>
      {children}
    </View>
  );
}

const Money = ({ value }: { value: number }) => (
  <MoneyText value={value} font="bold" className="text-base" />
);

/** One paid bill: items, how it was paid, tip and who took the payment. */
export default function TransactionDetailsScreen() {
  const brand = useBrandColors();
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({ queryKey: paymentKey(id), queryFn: () => getPayment(id) });

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/transactions'));

  if (query.isPending) return <LoadingView />;
  if (query.isError && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void query.refetch()} />;
  }
  const payment = query.data;
  if (!payment) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ScreenHeader title={t('history.detail.title')} onBack={goBack} />
        <Text tone="muted" className="px-6 pt-10 text-center text-lg">
          {t('history.detail.notFound')}
        </Text>
      </SafeAreaView>
    );
  }

  const Icon = methodIcon[payment.method];
  const method = t(methodKey(payment.method));
  const date = `${formatDay(payment.createdAt)} · ${formatTime(payment.createdAt)}`;
  const hasFees = payment.packingFeeEtb > 0 || payment.deliveryFeeEtb > 0;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader title={payment.label} subtitle={t('history.detail.title')} onBack={goBack} />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View
          className="mx-4 mt-1 items-center gap-1 rounded-card bg-primary px-5 py-[18px]"
          accessible
          accessibilityLabel={`${t('history.detail.paidWith', { method })}, ${formatMoney(payment.salesEtb)}, ${date}`}
        >
          <View className="h-[52px] w-[52px] items-center justify-center rounded-full bg-surface">
            <Icon size={28} color={brand.primary} strokeWidth={2.6} />
          </View>
          <Text font="bold" tone="inverse" className="mt-1 text-base">
            {t('history.detail.paidWith', { method })}
          </Text>
          <MoneyText
            value={payment.salesEtb}
            tone="inverse"
            className="text-4xl"
            numberOfLines={1}
            adjustsFontSizeToFit
          />
          <Text font="semibold" tone="inverse" className="text-[15px]">
            {date}
          </Text>
        </View>

        <View className="mx-4 mt-3 rounded-card border-[1.5px] border-border bg-surface px-[18px] py-1">
          <Text font="bold" tone="muted" className="pt-2.5 text-[15px]">
            {t('history.detail.items')}
          </Text>
          {payment.items.map((item, i) => (
            <DetailRow key={`${item.name}-${i}`} label={`${item.quantity} × ${item.name}`}>
              <Money value={item.priceEtb * item.quantity} />
            </DetailRow>
          ))}
          {hasFees ? (
            <>
              <DetailRow label={t('history.detail.food')}>
                <Money value={payment.foodTotalEtb} />
              </DetailRow>
              {payment.packingFeeEtb > 0 ? (
                <DetailRow label={t('history.detail.packing')}>
                  <Money value={payment.packingFeeEtb} />
                </DetailRow>
              ) : null}
              {payment.deliveryFeeEtb > 0 ? (
                <DetailRow label={t('history.detail.delivery')}>
                  <Money value={payment.deliveryFeeEtb} />
                </DetailRow>
              ) : null}
            </>
          ) : null}
          <DetailRow label={t('history.detail.total')} last>
            <Money value={payment.salesEtb} />
          </DetailRow>
        </View>

        <View className="mx-4 mt-3 rounded-card border-[1.5px] border-border bg-surface px-[18px] py-1">
          {payment.cashEtb > 0 ? (
            <DetailRow label={t('history.detail.cash')}>
              <Money value={payment.cashEtb} />
            </DetailRow>
          ) : null}
          {payment.bankEtb > 0 ? (
            <DetailRow label={t('history.detail.bank')}>
              <Money value={payment.bankEtb} />
            </DetailRow>
          ) : null}
          {payment.tipEtb > 0 ? (
            <DetailRow label={t('history.detail.tip', { name: payment.waiterName })}>
              <Money value={payment.tipEtb} />
            </DetailRow>
          ) : null}
          {payment.changeEtb > 0 ? (
            <DetailRow label={t('history.detail.change')}>
              <Money value={payment.changeEtb} />
            </DetailRow>
          ) : null}
          <DetailRow label={t('history.detail.waiter')}>
            <Text font="bold" className="text-base">
              {payment.waiterName}
            </Text>
          </DetailRow>
          <DetailRow label={t('history.detail.recordedBy')} last>
            <Text font="bold" className="text-base">
              {payment.recordedBy}
            </Text>
          </DetailRow>
        </View>

        <View className="min-h-6 flex-1" />

        <View className="px-4 pb-3">
          <Button label={t('history.detail.back')} onPress={goBack} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
