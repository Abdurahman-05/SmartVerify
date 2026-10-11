import { useRouter } from 'expo-router';
import { Check, ChefHat } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { LoadingView } from '@/components/ui/LoadingView';
import { NoConnection } from '@/components/ui/NoConnection';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { useSession } from '@/store/session';

import { minutesSince, NoteChips, TypeTile, useNow, useOrderSubtitle, WaitTag } from './parts';
import type { KitchenOrder, KitchenStatus } from './types';
import { useKitchenActions, useKitchenOrders } from './useKitchenData';

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
      <Text
        font="bold"
        tone={selected ? 'inverse' : 'default'}
        className="text-[17px]"
        numberOfLines={1}
      >
        {label}
      </Text>
      <View
        className={`h-7 min-w-7 items-center justify-center rounded-full px-1.5 ${selected ? 'bg-surface' : 'bg-primaryTile'}`}
      >
        <Text font="bold" className="text-[15px] text-primary">
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

function OrderCard({
  order,
  now,
  onStart,
  onReady,
  busy,
}: {
  order: KitchenOrder;
  now: number;
  onStart: () => void;
  onReady: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const subtitleFor = useOrderSubtitle();

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
        {order.items.map((item, i) => (
          <View key={`${item.name}-${i}`} className="flex-row items-center gap-2.5">
            <View className="h-8 min-w-9 items-center justify-center rounded-[10px] bg-primaryTile px-1">
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
        <Button
          label={t('kitchen.startCooking')}
          icon={ChefHat}
          size="md"
          disabled={busy}
          onPress={onStart}
        />
      ) : order.status === 'cooking' ? (
        <Button
          label={t('kitchen.markReady')}
          icon={Check}
          size="md"
          disabled={busy}
          onPress={onReady}
        />
      ) : null}
    </Pressable>
  );
}

export default function KitchenScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const chefName = useSession((s) => s.user?.displayName ?? '');
  const query = useKitchenOrders();
  const { start, ready, failed } = useKitchenActions();
  const [tab, setTab] = useState<KitchenStatus>('new');
  const now = useNow();

  if (query.isPending) return <LoadingView />;
  if (query.isError && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void query.refetch()} />;
  }
  const orders = query.data ?? [];
  const busyId = start.isPending ? start.variables : ready.isPending ? ready.variables : null;

  const shown = orders
    .filter((o) => o.status === tab)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader
        title={t('kitchen.title')}
        subtitle={t('kitchen.chef', { name: chefName })}
        right={
          <Pressable
            onPress={() => router.push('/profile')}
            accessibilityRole="button"
            accessibilityLabel={t('profile.open')}
            className="h-11 w-11 items-center justify-center rounded-full bg-primary active:opacity-80"
          >
            <Text font="bold" tone="inverse" className="text-lg">
              {chefName.charAt(0).toUpperCase()}
            </Text>
          </Pressable>
        }
      />

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
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            now={now}
            busy={busyId === item.id}
            onStart={() => start.mutate(item.id)}
            onReady={() => ready.mutate(item.id)}
          />
        )}
        ListEmptyComponent={
          <Text tone="muted" className="pt-10 text-center text-lg">
            {query.isError ? t(errorMessageKey(query.error)) : t('kitchen.empty')}
          </Text>
        }
      />

      <ErrorDialog
        visible={Boolean(failed)}
        title={t('kitchen.actionFailedTitle')}
        message={t(errorMessageKey(failed?.error))}
        actionLabel={t('errors.retry')}
        onClose={() => failed?.reset()}
      />
    </SafeAreaView>
  );
}
