import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Banknote,
  Bell,
  ChartColumn,
  CookingPot,
  Star,
  TriangleAlert,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconTile, type IconTileProps } from '@/components/ui/IconTile';
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

import { targetOf } from './target';
import { GlassCard, ScreenBg } from '@/ui/glass';

const icons: Record<string, LucideIcon> = {
  new_order: CookingPot,
  order_added: CookingPot,
  order_changed: CookingPot,
  order_cancelled: TriangleAlert,
  order_ready: CookingPot,
  big_payment: Banknote,
  bad_receipt: TriangleAlert,
  daily_summary: ChartColumn,
  plan_ending: Star,
  plan_late: TriangleAlert,
  new_expense: Wallet,
  expense_deleted: TriangleAlert,
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
      case 'new_expense':
        return {
          title: t('notifications.newExpense.title', { amount: formatMoney(num(d.amountEtb)) }),
          body: t('notifications.newExpense.body', {
            name: str(d.name),
            title: str(d.title),
            from: t(d.paidFrom === 'BANK' ? 'extras.bank' : 'extras.cash'),
          }),
        };
      case 'expense_deleted':
        return {
          title: t('notifications.expenseDeleted.title', { title: str(d.title) }),
          body: t('notifications.expenseDeleted.body', { reason: str(d.reason) }),
        };
      default:
        return { title: t('notifications.title'), body: '' };
    }
  };
}

/** Icon tile tone by kind: red warnings, green money in, amber spending; food and plan in brand. */
const tileTone: Record<string, NonNullable<IconTileProps['tone']>> = {
  bad_receipt: 'red',
  plan_late: 'red',
  order_cancelled: 'red',
  expense_deleted: 'red',
  big_payment: 'green',
  daily_summary: 'green',
  new_expense: 'amber',
};

function Row({
  item,
  unread,
  onPress,
}: {
  item: AppNotification;
  unread: boolean;
  onPress: (() => void) | null;
}) {
  const { t } = useTranslation();
  const text = useNotificationText();
  const { title, body } = text(item);
  const Icon = icons[item.type] ?? Star;
  const today = new Date(item.createdAt).toDateString() === new Date().toDateString();

  return (
    <GlassCard
      onPress={onPress ?? undefined}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${unread ? `${t('notifications.unread')}, ` : ''}${title}, ${body}`}
      className={`flex-row items-start gap-3 px-3.5 py-3.5 ${unread ? 'border-2 border-primary' : ''}`}
    >
      <IconTile
        icon={Icon}
        tone={tileTone[item.type] ?? 'brand'}
        size={48}
        radius={14}
        iconSize={22}
      />
      <View className="flex-1">
        <View className="flex-row items-start justify-between gap-2">
          <Text font="bold" className="flex-1 text-base leading-[21px]">
            {title}
          </Text>
          <Text tone="muted" className="text-sm">
            {today ? formatTime(item.createdAt) : formatDay(item.createdAt, false)}
          </Text>
          {unread ? <View className="mt-1.5 h-2.5 w-2.5 rounded-full bg-primary" /> : null}
        </View>
        {body ? (
          <Text tone="muted" className="mt-0.5 text-sm leading-[19px]">
            {body}
          </Text>
        ) : null}
      </View>
    </GlassCard>
  );
}

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const brand = useBrandColors();
  const queryClient = useQueryClient();
  const role = useSession((s) => s.user?.role);
  const query = useQuery({ queryKey: notificationsKey, queryFn: getNotifications });
  const markRead = useMutation({
    mutationFn: () => markNotificationsRead(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: notificationsKey }),
  });
  // What was new when the page opened stays marked until "Mark all read" (or leaving).
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());

  // Opening the page: fresh list, and everything on it counts as seen.
  const { refetch } = query;
  const { mutate } = markRead;
  useFocusEffect(
    useCallback(() => {
      void refetch().then((result) => {
        const items = result.data?.items ?? [];
        setFresh(new Set(items.filter((n) => !n.read).map((n) => n.id)));
        if (result.data?.unread) mutate();
      });
    }, [refetch, mutate])
  );

  if (query.isError && !query.data && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void query.refetch()} />;
  }
  if (!query.data) return <LoadingView screenTitle={t('notifications.alertsTitle')} />;

  const isNew = (n: AppNotification) => !n.read || fresh.has(n.id);
  const newCount = query.data.items.filter(isNew).length;
  const markAll = () => {
    setFresh(new Set());
    if (query.data?.unread) mutate();
  };

  return (
    <ScreenBg>
      <SafeAreaView edges={['top']} className="flex-1">
        <ScreenHeader
          title={t('notifications.alertsTitle')}
          subtitle={t('notifications.newCount', { count: newCount })}
          right={
            newCount > 0 ? (
              <Pressable
                onPress={markAll}
                accessibilityRole="button"
                hitSlop={8}
                className="min-h-11 justify-center px-1 active:opacity-70"
              >
                <Text font="bold" className="text-[15px]" style={{ color: brand.primaryDeep }}>
                  {t('notifications.markAllRead')}
                </Text>
              </Pressable>
            ) : null
          }
        />
        <FlatList
          data={query.data.items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingBottom: 24 }}
          ListEmptyComponent={
            <View className="items-center gap-2 px-6 py-16">
              <Bell size={36} color={colors.muted} strokeWidth={2} />
              <Text tone="muted" className="text-center text-base">
                {t('notifications.empty')}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const target = targetOf(item.type, item.data, role);
            return (
              <Row
                item={item}
                unread={isNew(item)}
                onPress={target ? () => router.push(target) : null}
              />
            );
          }}
        />
      </SafeAreaView>
    </ScreenBg>
  );
}
