import { useRouter } from 'expo-router';
import { ChefHat, ListChecks } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { GlassCard } from '@/components/ui/GlassCard';
import { LoadingView } from '@/components/ui/LoadingView';
import { NoConnection } from '@/components/ui/NoConnection';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Segmented } from '@/components/ui/Segmented';
import { Text } from '@/components/ui/Text';
import { useGlass } from '@/components/ui/glassTokens';
import { Avatar } from '@/features/waiter/Avatar';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { useFeatures } from '@/store/features';
import { useSession } from '@/store/session';
import { colors } from '@/theme/tokens';
import { ScreenBg } from '@/ui/glass';

import {
  isLate,
  minutesSince,
  NoteRow,
  OrderBadge,
  QtyBadge,
  useNow,
  useOrderTitle,
  WaitTag,
} from './parts';
import type { KitchenOrder, KitchenStatus } from './types';
import { useKitchenActions, useKitchenOrders } from './useKitchenData';

const tabs: KitchenStatus[] = ['new', 'cooking', 'ready'];

function OrderCard({
  order,
  now,
  urgent,
  onStart,
  onReady,
  busy,
}: {
  order: KitchenOrder;
  now: number;
  /** The oldest late ticket: a primary border. */
  urgent: boolean;
  onStart: () => void;
  onReady: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const g = useGlass();
  const titleFor = useOrderTitle();

  return (
    <GlassCard
      onPress={() => router.push({ pathname: '/kitchen/[id]', params: { id: order.id } })}
      accessibilityRole="button"
      accessibilityLabel={t('kitchen.openOrder', { label: order.label })}
      highlight={urgent ? g.primary : undefined}
      style={{ padding: 14, gap: 10 }}
    >
      <View className="flex-row items-center gap-3">
        <OrderBadge order={order} />
        <View className="min-w-0 flex-1">
          <Text font="bold" className="text-lg leading-6" numberOfLines={2}>
            {titleFor(order)}
          </Text>
          <Text tone="muted" className="text-sm" numberOfLines={1}>
            {t('kitchen.waiter', { name: order.waiterName })}
          </Text>
        </View>
        <WaitTag minutes={minutesSince(order.createdAt, now)} />
      </View>

      <View>
        {order.items.map((item, i) => (
          <View
            key={`${item.name}-${i}`}
            className={`flex-row items-center gap-3 py-2.5 ${i ? 'border-t border-black/[0.07]' : ''}`}
          >
            <QtyBadge qty={item.qty} />
            <Text font="bold" className="flex-1 text-lg">
              {item.name}
            </Text>
          </View>
        ))}
      </View>

      <NoteRow notes={order.notes} />

      {order.status === 'new' ? (
        <PrimaryButton
          label={t('kitchen.startCooking')}
          icon={ChefHat}
          disabled={busy}
          onPress={onStart}
        />
      ) : order.status === 'cooking' ? (
        <PrimaryButton label={t('kitchen.markReady')} disabled={busy} onPress={onReady} />
      ) : null}
    </GlassCard>
  );
}

export default function KitchenScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const chefName = useSession((s) => s.user?.displayName ?? '');
  const buyList = useFeatures((s) => s.featureBuyList);
  const query = useKitchenOrders();
  const { start, ready, failed } = useKitchenActions();
  const [tab, setTab] = useState<KitchenStatus>('new');
  const now = useNow();

  if (query.isPending) return <LoadingView screenTitle={t('kitchen.title')} />;
  if (query.isError && !query.data && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void query.refetch()} />;
  }
  const orders = query.data ?? [];
  const busyId = start.isPending ? start.variables : ready.isPending ? ready.variables : null;

  const shown = orders
    .filter((o) => o.status === tab)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  // Oldest first: the first ticket is the one to mark when it is late.
  const urgentId = shown[0] && isLate(minutesSince(shown[0].createdAt, now)) ? shown[0].id : null;

  return (
    <ScreenBg>
      <SafeAreaView edges={['top']} className="flex-1">
        <ScreenHeader
          title={t('kitchen.title')}
          subtitle={t('kitchen.chef', { name: chefName })}
          right={
            buyList ? (
              <GlassCard
                radius={28}
                onPress={() => router.push('/finished')}
                accessibilityRole="button"
                accessibilityLabel={t('extras.finished.open')}
                style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }}
              >
                <ListChecks size={24} color={colors.text} strokeWidth={2.2} />
              </GlassCard>
            ) : (
              <Pressable
                onPress={() => router.push('/profile')}
                accessibilityRole="button"
                accessibilityLabel={t('profile.open')}
                className="active:opacity-80"
              >
                <Avatar name={chefName} />
              </Pressable>
            )
          }
        />

        <View className="px-4 pb-3">
          <Segmented
            options={tabs.map((status) => ({
              value: status,
              label: `${t(`kitchen.tab.${status}`)} · ${orders.filter((o) => o.status === status).length}`,
            }))}
            value={tab}
            onChange={setTab}
          />
        </View>

        <FlatList
          data={shown}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingBottom: 16 }}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              now={now}
              urgent={item.id === urgentId}
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
    </ScreenBg>
  );
}
