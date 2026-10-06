import { useQuery } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { LoadingView } from '@/components/ui/LoadingView';
import { ResultBadge } from '@/components/ui/ResultBadge';
import { Text } from '@/components/ui/Text';
import { getOrder, type Order } from '@/lib/mock/restaurant';
import { formatAmount } from '@/lib/format';

function useTargetLabel(order: Order) {
  const { t } = useTranslation();
  const { target } = order;
  switch (target.type) {
    case 'dineIn':
      return `${t('orders.table', { number: target.tableNumber })} · ${t(`orders.area.${target.area}`)}`;
    case 'takeaway':
      return t('orders.sentTakeaway', { name: target.customerName });
    case 'delivery':
      return t('orders.sentDelivery', { area: target.areaName });
  }
}

function SentView({ order }: { order: Order }) {
  const { t } = useTranslation();
  const router = useRouter();
  const etb = (n: number) => `${formatAmount(n)} ${t('common.etb')}`;
  const deliveryFee = order.target.type === 'delivery' ? order.target.deliveryFeeEtb : null;
  const rows = [
    { label: t('orders.sentFor'), value: useTargetLabel(order) },
    ...order.lines.map((l) => ({ label: `${l.quantity} × ${l.name}`, value: etb(l.priceEtb * l.quantity) })),
    ...(deliveryFee !== null ? [{ label: t('orders.deliveryFee'), value: etb(deliveryFee) }] : []),
    { label: t('orders.foodTotal'), value: etb(order.foodTotalEtb) },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center" accessibilityLiveRegion="assertive">
          <ResultBadge success />
          <Text font="heading" className="mt-5 text-center text-[26px]" accessibilityRole="header">
            {t('orders.sentTitle')}
          </Text>
          <Text className="mt-2.5 max-w-[300px] text-center text-base leading-6 text-navInactive">
            {t('orders.sentBody', { number: order.number })}
          </Text>
        </View>

        <View className="mt-8 rounded-[20px] border border-border bg-surface px-5 py-1">
          {rows.map((row, i) => (
            <View
              key={`${row.label}-${i}`}
              accessible
              className={`flex-row items-center justify-between gap-4 py-3.5 ${i < rows.length - 1 ? 'border-b border-divider' : ''}`}
            >
              <Text className="flex-1 text-[15px] text-navInactive">{row.label}</Text>
              <Text font="semibold" className="text-right text-base">
                {row.value}
              </Text>
            </View>
          ))}
        </View>

        <View className="min-h-6 flex-1" />

        <View className="gap-3">
          <Button label={t('orders.newOrder')} onPress={() => router.replace('/orders')} />
          <Button
            label={t('orders.goHome')}
            variant="secondary"
            size="md"
            onPress={() => router.dismissTo('/home')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function OrderSentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: order, isPending } = useQuery({ queryKey: ['order', id], queryFn: () => getOrder(id) });

  if (isPending) return <LoadingView />;
  if (!order) return <Redirect href="/home" />;
  return <SentView order={order} />;
}
