import { useRouter } from 'expo-router';
import { Check, ChefHat } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { useSession } from '@/store/session';

import { minutesSince, NoteChips, TypeTile, useNow, useOrderSubtitle, WaitTag } from './parts';
import { useKitchen } from './store';
import type { KitchenOrder, KitchenStatus } from './types';

const tabs: KitchenStatus[] = ['new', 'cooking', 'ready'];

function TabButton({
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
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      className={`h-14 flex-1 flex-row items-center justify-center gap-2 rounded-[18px] px-1 ${
        selected ? 'bg-primary' : 'border-2 border-borderStrong bg-surface'
      }`}
    >
      <Text font="bold" tone={selected ? 'inverse' : 'default'} className="text-[17px]" numberOfLines={1}>
        {label}
      </Text>
      <View
        className={`h-7 min-w-7 items-center justify-center rounded-full px-1.5 ${selected ? 'bg-surface' : 'bg-successBg'}`}
      >
        <Text font="bold" className="text-[15px] text-primary">
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

function OrderCard({ order, now }: { order: KitchenOrder; now: number }) {
  const { t } = useTranslation();
  const router = useRouter();
  const subtitleFor = useOrderSubtitle();
  const { startCooking, markReady } = useKitchen();

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/kitchen/[id]', params: { id: order.id } })}
      accessibilityRole="button"
      accessibilityLabel={t('kitchen.openOrder', { label: order.label })}
      className="gap-2.5 rounded-card border-[1.5px] border-border bg-surface px-3.5 py-3 active:bg-background"
    >
      <View className="flex-row items-center gap-2.5">
        <TypeTile type={order.type} />
        <View className="flex-1">
          <Text font="heading" className="text-xl leading-tight" numberOfLines={1}>
            {order.label}
          </Text>
          <Text tone="muted" className="text-sm" numberOfLines={1}>
            {subtitleFor(order)}
          </Text>
        </View>
        <WaitTag minutes={minutesSince(order.createdAt, now)} />
      </View>

      <View className="gap-1.5">
        {order.items.map((item) => (
          <View key={item.name} className="flex-row items-center gap-2.5">
            <View className="h-8 min-w-9 items-center justify-center rounded-[10px] bg-successBg px-1">
              <Text font="bold" className="text-lg text-primary">
                {item.qty}×
              </Text>
            </View>
            <Text font="bold" className="flex-1 text-xl">
              {item.name}
            </Text>
          </View>
        ))}
      </View>

      <NoteChips notes={order.notes} />

      {order.status === 'new' ? (
        <Button label={t('kitchen.startCooking')} icon={ChefHat} size="md" onPress={() => startCooking(order.id)} />
      ) : order.status === 'cooking' ? (
        <Button label={t('kitchen.markReady')} icon={Check} size="md" onPress={() => markReady(order.id)} />
      ) : null}
    </Pressable>
  );
}

export default function KitchenScreen() {
  const { t } = useTranslation();
  const chefName = useSession((s) => s.user?.displayName ?? '');
  const orders = useKitchen((s) => s.orders);
  const [tab, setTab] = useState<KitchenStatus>('new');
  const now = useNow();

  const shown = orders
    .filter((o) => o.status === tab)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader title={t('kitchen.title')} subtitle={t('kitchen.chef', { name: chefName })} />

      <View className="flex-row gap-2 px-4 pb-3 pt-1" accessibilityRole="tablist">
        {tabs.map((status) => (
          <TabButton
            key={status}
            label={t(`kitchen.tab.${status}`)}
            count={orders.filter((o) => o.status === status).length}
            selected={tab === status}
            onPress={() => setTab(status)}
          />
        ))}
      </View>

      <FlatList
        data={shown}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingBottom: 16 }}
        renderItem={({ item }) => <OrderCard order={item} now={now} />}
        ListEmptyComponent={
          <Text tone="muted" className="pt-10 text-center text-lg">
            {t('kitchen.empty')}
          </Text>
        }
      />
    </SafeAreaView>
  );
}
