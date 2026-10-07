import type { TFunction } from 'i18next';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ChefHat } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';

import { minutesSince, useNow } from './parts';
import { useKitchen } from './store';
import type { KitchenOrder } from './types';

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
  const order = useKitchen((s) => s.orders.find((o) => o.id === id));
  const { startCooking, markReady } = useKitchen();
  const now = useNow();

  const backToKitchen = () => (router.canGoBack() ? router.back() : router.replace('/kitchen'));

  if (!order) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ScreenHeader title={t('kitchen.title')} onBack={backToKitchen} />
        <Text tone="muted" className="px-6 pt-10 text-center text-lg">
          {t('kitchen.notFound')}
        </Text>
      </SafeAreaView>
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

  const act = () => {
    if (order.status === 'new') startCooking(order.id);
    else if (cooking) markReady(order.id);
    backToKitchen();
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader
        title={order.label}
        subtitle={t('kitchen.orderLine', { number: order.orderNo, name: order.waiterName })}
        onBack={backToKitchen}
      />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View
          accessible
          className="mx-4 mt-1 flex-row items-center justify-between gap-3 rounded-card bg-primary px-5 py-3.5"
        >
          <View>
            <Text font="semibold" tone="inverse" className="text-[15px]">
              {timerLabel}
            </Text>
            <Text font="heading" tone="inverse" className="text-[38px] leading-tight">
              {t('kitchen.minutes', { count: minutes })}
            </Text>
          </View>
          <View className="items-end">
            <Text font="semibold" tone="inverse" className="text-[15px]">
              {t(`kitchen.type.${order.type}`)}
            </Text>
            {detail ? (
              <Text font="bold" tone="inverse" className="text-[17px]">
                {detail}
              </Text>
            ) : null}
          </View>
        </View>

        <View className="mx-4 mt-3 rounded-card border-[1.5px] border-border bg-surface px-4">
          {order.items.map((item, i) => (
            <View
              key={item.name}
              accessible
              className={`flex-row items-center gap-3.5 py-3.5 ${i < order.items.length - 1 ? 'border-b-[1.5px] border-divider' : ''}`}
            >
              <View className="h-12 min-w-[52px] items-center justify-center rounded-[14px] bg-primaryTile px-1">
                <Text font="bold" className="text-2xl text-primary">
                  {item.qty}×
                </Text>
              </View>
              <Text font="bold" className="flex-1 text-2xl">
                {item.name}
              </Text>
            </View>
          ))}
        </View>

        {order.notes.length > 0 ? (
          <View
            accessible
            className="mx-4 mt-3 rounded-[20px] border-[2.5px] border-amber bg-tipBg px-4 py-3"
          >
            <Text font="bold" className="text-[15px] text-warnFg">
              {t('kitchen.notesTitle')}
            </Text>
            <Text font="bold" className="mt-1 text-[22px]">
              {order.notes.map((n) => t(`orders.note.${n}`, { defaultValue: n })).join(' · ')}
            </Text>
          </View>
        ) : null}

        <View className="min-h-6 flex-1" />

        <View className="gap-2.5 px-4 pb-6">
          {order.status === 'new' ? (
            <Button label={t('kitchen.startCooking')} icon={ChefHat} onPress={act} />
          ) : cooking ? (
            <Button label={t('kitchen.markReady')} icon={Check} onPress={act} />
          ) : null}
          <Button label={t('kitchen.back')} variant="outline" size="md" onPress={backToKitchen} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
