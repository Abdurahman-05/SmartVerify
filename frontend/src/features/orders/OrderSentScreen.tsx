import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Send } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBackFallback } from '@/hooks/useBackFallback';
import { useSession } from '@/store/session';
import { GhostButton } from '@/components/ui/GhostButton';
import { useGlass } from '@/components/ui/glassTokens';
import { StickyFooter } from '@/components/ui/StickyFooter';
import { formatMoney } from '@/components/ui/MoneyText';
import { LoadingView } from '@/components/ui/LoadingView';
import { NoConnection } from '@/components/ui/NoConnection';
import { Text } from '@/components/ui/Text';
import { areaLabel } from '@/lib/areaLabel';
import { getOrder, getTables, tablesKey, type Order } from '@/lib/restaurant';
import { GlassCard, HeroCard, PrimaryButton, ScreenBg } from '@/ui/glass';

function useTargetLabel(order: Order) {
  const { t, i18n } = useTranslation();
  const { target } = order;
  // The Amharic name of the table's category comes from the loaded tables, when they are there.
  const { data: tables } = useQuery({ queryKey: tablesKey, queryFn: getTables });
  switch (target.type) {
    case 'dineIn':
      return `${t('orders.table', { number: target.tableNumber })} · ${areaLabel(
        t,
        i18n.language,
        target.area,
        tables?.find((table) => table.id === target.tableId)?.categoryNameAm
      )}`;
    case 'takeaway':
      return t('orders.sentTakeaway', { name: target.customerName });
    case 'delivery':
      return t('orders.sentDelivery', { area: target.areaName });
  }
}

/** Flat deep circle with a send icon in a soft tile ring. */
function SentMark() {
  const g = useGlass();
  return (
    <View
      className="h-[104px] w-[104px] items-center justify-center rounded-full"
      style={{ backgroundColor: g.tile }}
    >
      <View
        className="h-[78px] w-[78px] items-center justify-center rounded-full"
        style={{ backgroundColor: g.primaryDeep }}
      >
        <Send size={36} color="#FFFFFF" strokeWidth={2.2} />
      </View>
    </View>
  );
}

function SentView({ order }: { order: Order }) {
  const { t } = useTranslation();
  const router = useRouter();
  const isWaiter = useSession((s) => s.user?.role === 'waiter' && s.user.plan === 'restaurant');
  useBackFallback(isWaiter ? '/new-order' : '/home');
  const g = useGlass();
  const target = useTargetLabel(order);
  const deliveryFee = order.target.type === 'delivery' ? order.target.deliveryFeeEtb : null;
  const notes = order.target.type === 'dineIn' ? order.notes : [];

  return (
    <ScreenBg>
      <SafeAreaView className="flex-1">
        <ScrollView
          contentContainerStyle={{ gap: 12, padding: 16, paddingTop: 48, paddingBottom: 170 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="items-center gap-2" accessibilityLiveRegion="assertive">
            <SentMark />
            <Text
              font="heading"
              className="text-center text-[26px] leading-8"
              accessibilityRole="header"
            >
              {t('orders.sentTitle')}
            </Text>
            <Text tone="muted" className="max-w-[320px] text-center text-[15px] leading-[21px]">
              {target} · {t('orders.sentBody', { number: order.number })}
            </Text>
          </View>

          <GlassCard className="px-4 py-1.5">
            {order.lines.map((l, i) => (
              <View
                key={`${l.name}-${i}`}
                accessible
                className={`flex-row items-center gap-3 py-2.5 ${i ? 'border-t border-black/[0.07]' : ''}`}
              >
                <View
                  className="h-8 w-8 items-center justify-center rounded-[10px]"
                  style={{ backgroundColor: g.primaryDeep }}
                >
                  <Text font="bold" tone="inverse" className="text-sm">
                    {l.quantity}
                  </Text>
                </View>
                <Text font="semibold" className="flex-1 text-base">
                  {l.name}
                </Text>
                <Text font="heading" className="text-base">
                  {formatMoney(l.priceEtb * l.quantity, false)}
                </Text>
              </View>
            ))}
            {deliveryFee !== null ? (
              <View
                className="flex-row items-center border-t border-black/[0.07] py-2.5"
                accessible
              >
                <Text tone="muted" className="flex-1 text-base">
                  {t('orders.deliveryFee')}
                </Text>
                <Text font="heading" className="text-base">
                  {formatMoney(deliveryFee, false)}
                </Text>
              </View>
            ) : null}
            {notes.length ? (
              <View
                className="flex-row flex-wrap items-center gap-2 border-t border-black/[0.07] py-2.5"
                accessible
              >
                <View className="rounded-full bg-[#FFF4CC] px-3 py-1.5">
                  <Text font="bold" className="text-sm text-[#8A4B00]">
                    {t('orders.noteLabel')}
                  </Text>
                </View>
                <Text tone="muted" className="shrink text-base">
                  {notes.map((n) => t(`orders.note.${n}`)).join(', ')}
                </Text>
              </View>
            ) : null}
          </GlassCard>

          <HeroCard
            style={{ borderRadius: 24, paddingVertical: 16, paddingHorizontal: 20 }}
            className="flex-row items-center"
          >
            <Text font="bold" tone="inverse" className="flex-1 text-base uppercase tracking-wider">
              {t('orders.total')}
            </Text>
            <Text font="heading" tone="inverse" className="text-base">
              {formatMoney(order.foodTotalEtb + (deliveryFee ?? 0))}
            </Text>
          </HeroCard>
        </ScrollView>

        <StickyFooter>
          <PrimaryButton
            label={t('orders.newOrder')}
            onPress={() => router.dismissTo(isWaiter ? '/new-order' : '/orders')}
          />
          <GhostButton label={t('orders.goHome')} onPress={() => router.navigate('/bills')} />
        </StickyFooter>
      </SafeAreaView>
    </ScreenBg>
  );
}

export default function OrderSentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    data: order,
    isPending,
    refetch,
  } = useQuery({
    queryKey: ['order', id],
    queryFn: () => getOrder(id),
  });

  if (isPending) return <LoadingView />;
  // The order could not be loaded: say so, with Retry, instead of silently going Home.
  if (!order) return <NoConnection fullPage onRetry={() => void refetch()} />;
  return <SentView order={order} />;
}
