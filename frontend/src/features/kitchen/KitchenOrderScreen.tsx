import type { TFunction } from 'i18next';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ChefHat, ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { LoadingView } from '@/components/ui/LoadingView';
import { NoConnection } from '@/components/ui/NoConnection';
import { GlassCard } from '@/components/ui/GlassCard';
import { HeroCard } from '@/components/ui/HeroCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StickyFooter } from '@/components/ui/StickyFooter';
import { TopBar } from '@/components/ui/TopBar';
import { Text } from '@/components/ui/Text';
import { errorMessageKey, isNetworkError } from '@/lib/errors';

import { colors } from '@/theme/tokens';

import { minutesSince, OrderBadge, QtyBadge, useNow } from './parts';
import type { KitchenOrder } from './types';
import { useKitchenActions, useKitchenOrders } from './useKitchenData';
import { ScreenBg } from '@/ui/glass';

function typeDetail(order: KitchenOrder, t: TFunction) {
  if (order.type === 'dine' && order.guests) return t('bills.guests', { count: order.guests });
  if (order.type === 'delivery') return order.area ?? '';
  if (order.type === 'takeaway') return order.customerName ?? '';
  return '';
}

export default function KitchenOrderScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useKitchenOrders();
  const { start, ready, failed } = useKitchenActions();
  const now = useNow();

  const backToKitchen = () => (router.canGoBack() ? router.back() : router.replace('/cook'));

  if (query.isPending || start.isPending || ready.isPending) return <LoadingView />;
  if (query.isError && !query.data && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void query.refetch()} />;
  }
  const order = query.data?.find((o) => o.id === id);
  if (!order) {
    return (
      <ScreenBg>
        <SafeAreaView className="flex-1">
          <ScreenHeader title={t('kitchen.title')} onBack={backToKitchen} />
          <Text tone="muted" className="px-6 pt-10 text-center text-lg">
            {t('kitchen.notFound')}
          </Text>
        </SafeAreaView>
      </ScreenBg>
    );
  }

  const cooking = order.status === 'cooking';
  const minutes = minutesSince(cooking && order.startedAt ? order.startedAt : order.createdAt, now);
  const timerLabel =
    order.status === 'new'
      ? t('kitchen.waiting')
      : cooking
        ? t('kitchen.cookingFor')
        : t('kitchen.readyFor');
  const detail = typeDetail(order, t);

  // Back to the list once the server has saved the change.
  const act = () => {
    if (order.status === 'new') start.mutate(order.id, { onSuccess: backToKitchen });
    else if (cooking) ready.mutate(order.id, { onSuccess: backToKitchen });
  };

  const title = t(`kitchen.tab.${order.status}`);

  return (
    <ScreenBg>
      <SafeAreaView className="flex-1">
        <View className="px-4 pb-3 pt-4">
          <TopBar
            title={title}
            subtitle={t('kitchen.orderLine', { number: order.orderNo, name: order.waiterName })}
            left={{ icon: ChevronLeft, onPress: backToKitchen, label: t('common.back') }}
          />
        </View>
        <ScrollView
          contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingBottom: 150 }}
          showsVerticalScrollIndicator={false}
        >
          <HeroCard style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <OrderBadge order={order} size={84} soft />
            <View accessible className="min-w-0 flex-1">
              <Text font="bold" tone="inverse" className="text-sm uppercase">
                {timerLabel}
              </Text>
              <Text font="heading" tone="inverse" className="text-2xl leading-8" numberOfLines={2}>
                {order.label} · {t(`kitchen.type.${order.type}`)}
                {detail ? ` · ${detail}` : ''}
              </Text>
            </View>
            <View className="items-center">
              <Text font="heading" tone="inverse" className="text-[44px] leading-[48px]">
                {minutes}
              </Text>
              <Text tone="inverse" className="text-sm">
                {t('kitchen.min')}
              </Text>
            </View>
          </HeroCard>

          <GlassCard style={{ paddingHorizontal: 16, paddingVertical: 2 }}>
            {order.items.map((item, i) => (
              <View
                key={`${item.name}-${i}`}
                accessible
                className={`flex-row items-center gap-3.5 py-3.5 ${i ? 'border-t border-black/[0.07]' : ''}`}
              >
                <QtyBadge qty={item.qty} big />
                <Text font="bold" className="flex-1 text-2xl">
                  {item.name}
                </Text>
              </View>
            ))}
          </GlassCard>

          {order.notes.length > 0 ? (
            <GlassCard
              highlight="#FACC15"
              accessibilityLabel={t('kitchen.noteFromWaiter')}
              style={{ paddingHorizontal: 16, paddingVertical: 14 }}
            >
              <Text font="bold" className="text-sm uppercase" style={{ color: colors.warnFg }}>
                {t('kitchen.noteFromWaiter')}
              </Text>
              <Text font="bold" className="mt-1 text-xl">
                {order.notes.map((n) => t(`orders.note.${n}`, { defaultValue: n })).join(' · ')}
              </Text>
            </GlassCard>
          ) : null}
        </ScrollView>

        {order.status === 'ready' ? null : (
          <StickyFooter>
            <PrimaryButton
              label={t(cooking ? 'kitchen.markReady' : 'kitchen.startCooking')}
              icon={cooking ? Check : ChefHat}
              onPress={act}
            />
            {cooking ? (
              <Text tone="muted" className="text-center text-sm">
                {t('kitchen.alertHint', { name: order.waiterName })}
              </Text>
            ) : null}
          </StickyFooter>
        )}

        <ErrorDialog
          visible={Boolean(failed)}
          title={t('kitchen.actionFailedTitle')}
          message={t(errorMessageKey(failed?.error))}
          actionLabel={t('errors.retry')}
          onClose={() => failed?.reset()}
        />
      </SafeAreaView>
    </ScreenBg>
  );
}
