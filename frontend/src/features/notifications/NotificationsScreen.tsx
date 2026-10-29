import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import {
  Bell,
  ChartColumn,
  ChefHat,
  CircleAlert,
  Clock,
  Landmark,
  ShieldAlert,
  Star,
  type LucideIcon,
} from 'lucide-react-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingView } from '@/components/ui/LoadingView';
import { formatMoney } from '@/components/ui/MoneyText';
import { NoConnection } from '@/components/ui/NoConnection';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { isNetworkError } from '@/lib/errors';
import { formatDay, formatTime } from '@/lib/format';
import {
  getNotifications,
  markNotificationsRead,
  notificationsKey,
  type AppNotification,
} from '@/lib/notifications';
import { useSession } from '@/store/session';
import { useBrandColors } from '@/store/theme';
import { colors } from '@/theme/tokens';

const icons: Record<string, LucideIcon> = {
  new_order: ChefHat,
  order_added: ChefHat,
  order_changed: ChefHat,
  order_cancelled: CircleAlert,
  order_ready: Bell,
  big_payment: Landmark,
  bad_receipt: ShieldAlert,
  daily_summary: ChartColumn,
  plan_ending: Clock,
  plan_late: CircleAlert,
};

const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');
const num = (v: unknown) => (typeof v === 'number' ? v : 0);

/** Title and line of a notification, from its type and values. */
function useNotificationText() {
  const { t } = useTranslation();
  const orderLabel = (d: Record<string, unknown>) =>
    d.type === 'dine' && d.table !== null && d.table !== undefined
      ? t('notifications.table', { table: str(d.table) })
      : t(d.type === 'delivery' ? 'notifications.delivery' : 'notifications.takeaway', {
          number: str(d.orderNo),
        });

  return (n: AppNotification): { title: string; body: string } => {
    const d = n.data;
    switch (n.type) {
      case 'new_order':
        return {
          title: t('notifications.newOrder.title', { label: orderLabel(d) }),
          body: t('notifications.newOrder.body', { count: num(d.items), number: str(d.orderNo) }),
        };
      case 'order_added':
        return {
          title: t('notifications.orderAdded.title', { label: orderLabel(d) }),
          body: t('notifications.orderAdded.body', { count: num(d.items), number: str(d.orderNo) }),
        };
      case 'order_changed':
        return {
          title: t('notifications.orderChanged.title', { label: orderLabel(d) }),
          body: t('notifications.orderChanged.body', { number: str(d.orderNo) }),
        };
      case 'order_cancelled':
        return {
          title: t('notifications.orderCancelled.title', { label: orderLabel(d) }),
          body: t('notifications.orderCancelled.body', {
            number: str(d.orderNo),
            reason: str(d.reason),
          }),
        };
      case 'order_ready':
        return {
          title: t('notifications.orderReady.title', { label: orderLabel(d) }),
          body: t('notifications.orderReady.body', { number: str(d.orderNo) }),
        };
      case 'big_payment':
        return {
          title: t('notifications.bigPayment.title', { amount: formatMoney(num(d.amountEtb)) }),
          body: t('notifications.bigPayment.body', {
            name: str(d.payerName),
            bank: str(d.bankCode),
          }),
        };
      case 'bad_receipt': {
        const reasons = Array.isArray(d.reasons) ? d.reasons.map(str) : [];
        return {
          title: t('notifications.badReceipt.title', { name: str(d.checkedBy) }),
          body: reasons.map((r) => t(`verifyBank.check.reasons.${r}`)).join(' '),
        };
      }
      case 'daily_summary':
        return {
          title: t('notifications.dailySummary.title'),
          body: t('notifications.dailySummary.body', {
            count: num(d.count),
            amount: formatMoney(num(d.totalEtb)),
          }),
        };
      case 'plan_ending':
        return {
          title: t('notifications.planEnding.title', { count: num(d.daysLeft) }),
          body: t('notifications.planEnding.body'),
        };
      case 'plan_late':
        return {
          title: t(`notifications.planLate.${str(d.status) || 'grace'}`),
          body: t('notifications.planLate.body'),
        };
      default:
        return { title: t('notifications.title'), body: '' };
    }
  };
}

/** Where tapping a notification goes. */
function targetOf(n: AppNotification, role: string | undefined): Href | null {
  switch (n.type) {
    case 'new_order':
    case 'order_added':
    case 'order_changed':
      return role === 'chef' ? '/cook' : null;
    case 'big_payment':
    case 'bad_receipt':
      return '/transactions';
    case 'daily_summary':
      return '/reports';
    case 'plan_ending':
    case 'plan_late':
      return role === 'owner' ? '/subscription' : null;
    default:
      return null;
  }
}

function Row({ item, onPress }: { item: AppNotification; onPress: (() => void) | null }) {
  const brand = useBrandColors();
  const text = useNotificationText();
  const { title, body } = text(item);
  const Icon = icons[item.type] ?? Star;
  const today = new Date(item.createdAt).toDateString() === new Date().toDateString();
  const alert = item.type === 'bad_receipt' || item.type === 'plan_late';

  return (
    <Pressable
      onPress={onPress ?? undefined}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      className={`min-h-[64px] flex-row gap-3 rounded-[18px] border-[1.5px] px-3.5 py-3 ${
        item.read ? 'border-border bg-surface' : 'border-primary bg-primarySoft'
      } active:opacity-80`}
    >
      <View
        className={`h-11 w-11 items-center justify-center rounded-full ${alert ? 'bg-dangerBg' : 'bg-surface'}`}
      >
        <Icon size={22} color={alert ? colors.dangerFg : brand.primary} strokeWidth={2.2} />
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-start justify-between gap-2">
          <Text font="bold" className="flex-1 text-base">
            {title}
          </Text>
          <Text tone="muted" className="text-sm">
            {today ? formatTime(item.createdAt) : formatDay(item.createdAt, false)}
          </Text>
        </View>
        {body ? (
          <Text tone="muted" className="text-[15px]">
            {body}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const role = useSession((s) => s.user?.role);
  const query = useQuery({ queryKey: notificationsKey, queryFn: getNotifications });
  const markRead = useMutation({
    mutationFn: () => markNotificationsRead(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: notificationsKey }),
  });

  // Opening the page: fresh list, and everything on it counts as seen.
  const { refetch } = query;
  const { mutate } = markRead;
  useFocusEffect(
    useCallback(() => {
      void refetch().then((result) => {
        if (result.data?.unread) mutate();
      });
    }, [refetch, mutate])
  );

  if (query.isError && !query.data && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void query.refetch()} />;
  }
  if (!query.data) return <LoadingView screenTitle={t('notifications.title')} />;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScreenHeader title={t('notifications.title')} />
      <FlatList
        data={query.data.items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 24 }}
        ListEmptyComponent={
          <View className="items-center gap-2 px-6 py-16">
            <Bell size={36} color={colors.muted} strokeWidth={2} />
            <Text tone="muted" className="text-center text-base">
              {t('notifications.empty')}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const target = targetOf(item, role);
          return <Row item={item} onPress={target ? () => router.push(target) : null} />;
        }}
      />
    </SafeAreaView>
  );
}
