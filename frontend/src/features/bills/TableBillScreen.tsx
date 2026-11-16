import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Banknote, ChevronLeft, Info, Lock, Pencil, Plus, ScanLine, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBrandColors } from '@/store/theme';
import { colors } from '@/theme/tokens';
import { LoadingView } from '@/components/ui/LoadingView';
import { GhostButton } from '@/components/ui/GhostButton';
import { GlassCard } from '@/components/ui/GlassCard';
import { useGlass } from '@/components/ui/glassTokens';
import { HeroCard, HeroChip } from '@/components/ui/HeroCard';
import { formatMoney, MoneyText } from '@/components/ui/MoneyText';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { StickyFooter } from '@/components/ui/StickyFooter';
import { TopBar } from '@/components/ui/TopBar';
import { NoConnection } from '@/components/ui/NoConnection';
import { Text } from '@/components/ui/Text';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { billKey, cancelOrder, changeOrderItems, getBill } from '@/lib/bills';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { useSession } from '@/store/session';

import { BillPill } from './BillPill';
import { EditOrderSheet } from './EditOrderSheet';
import { areaLabel } from '@/lib/areaLabel';

import type { Bill, BillOrder } from './types';

function useHeading(bill: Bill) {
  const { t, i18n } = useTranslation();
  switch (bill.type) {
    case 'dine':
      return {
        title: t('bills.titleTable', { number: bill.tableNo }),
        heroLabel: [
          bill.tableArea ? areaLabel(t, i18n.language, bill.tableArea, bill.tableAreaAm) : null,
          bill.guests ? t('bills.guests', { count: bill.guests }) : null,
        ]
          .filter(Boolean)
          .join(' · '),
        heroName: t('orders.table', { number: bill.tableNo }),
      };
    case 'takeaway':
      return {
        title: t('bills.titleTakeaway'),
        heroLabel: [t('bills.takeaway'), bill.phone].filter(Boolean).join(' · '),
        heroName: bill.customerName ?? '',
      };
    case 'delivery':
      return {
        title: t('bills.titleDelivery'),
        heroLabel: [t('bills.delivery'), bill.phone].filter(Boolean).join(' · '),
        heroName: [bill.area, bill.address].filter(Boolean).join(' · '),
      };
  }
}

function FeeRow({ label, note, value }: { label: string; note?: string; value: number }) {
  return (
    <View
      className="flex-row items-center justify-between gap-3 border-t border-black/[0.07] py-2.5"
      accessible
    >
      <View className="flex-1">
        <Text font="semibold" className="text-[15px]">
          {label}
        </Text>
        {note ? (
          <Text tone="muted" className="text-[13px]">
            {note}
          </Text>
        ) : null}
      </View>
      <MoneyText value={value} showCurrency={false} font="heading" className="text-[15px]" />
    </View>
  );
}

/** Quantity badge: 32 px, flat deep theme colour, white number. */
function Qty({ n, struck }: { n: number; struck?: string }) {
  const g = useGlass();
  return (
    <View
      className="h-8 w-8 items-center justify-center rounded-[10px]"
      style={{ backgroundColor: g.primaryDeep }}
    >
      <Text font="bold" tone="inverse" className={`text-[15px] ${struck ?? ''}`}>
        {n}
      </Text>
    </View>
  );
}

function BillView({ bill }: { bill: Bill }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { title, heroLabel, heroName } = useHeading(bill);
  const hasFees = bill.type !== 'dine';
  const queryClient = useQueryClient();
  const role = useSession((s) => s.user?.role);
  const [editing, setEditing] = useState<BillOrder | null>(null);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: billKey(bill.id) });
    void queryClient.invalidateQueries({ queryKey: ['bills'] });
  };
  const change = useMutation({
    mutationFn: (v: { orderId: string; items: { menuItemId: string; quantity: number }[] }) =>
      changeOrderItems(v.orderId, v.items),
    onSuccess: () => {
      setEditing(null);
      refresh();
    },
    onError: () => setEditing(null),
  });
  const cancel = useMutation({
    mutationFn: (v: { orderId: string; reason: string }) => cancelOrder(v.orderId, v.reason),
    onSuccess: refresh,
  });

  // Another waiter's bill: for looking only. The server refuses payment and changes anyway.
  const canAct = bill.canAct !== false;
  // The server decides too (ORDER_LOCKED); this only hides buttons that would fail.
  const canChange = (order: BillOrder) =>
    !order.cancelled &&
    order.kitchenStatus === 'new' &&
    bill.status === 'open' &&
    role !== 'chef' &&
    canAct;
  const askCancel = (order: BillOrder) => {
    const reasons = ['customerLeft', 'mistake', 'outOfStock'] as const;
    Alert.alert(
      t('bills.change.cancelTitle', { number: order.number }),
      t('bills.change.cancelBody'),
      [
        ...reasons.map((r) => ({
          text: t(`bills.change.reason.${r}`),
          style: 'destructive' as const,
          onPress: () =>
            cancel.mutate({ orderId: order.id, reason: t(`bills.change.reason.${r}`) }),
        })),
        { text: t('bills.change.keep'), style: 'cancel' as const },
      ]
    );
  };

  const editable = bill.orders?.find((o) => canChange(o));
  const itemCount = (
    bill.orders ? bill.orders.filter((o) => !o.cancelled).flatMap((o) => o.items) : bill.items
  ).reduce((sum, item) => sum + item.quantity, 0);
  const open = bill.status === 'open';

  return (
    <ScreenBackground>
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="px-4 pb-3 pt-2">
          <TopBar
            title={title}
            subtitle={t('bills.orderLine', { number: bill.orderNo, name: bill.waiterName })}
            left={{
              icon: ChevronLeft,
              onPress: () => (router.canGoBack() ? router.back() : router.replace('/bills')),
              label: t('common.back'),
            }}
            right={
              editable
                ? {
                    icon: Pencil,
                    onPress: () => setEditing(editable),
                    label: t('bills.change.edit'),
                  }
                : undefined
            }
          />
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: canAct && open ? 200 : 32,
            gap: 12,
          }}
          showsVerticalScrollIndicator={false}
        >
          <HeroCard style={{ alignItems: 'center' }}>
            <View accessible className="items-center">
              <Text
                font="bold"
                tone="inverse"
                className="text-[13px] uppercase tracking-[0.8px] opacity-90"
              >
                {t('bills.totalToPay')}
              </Text>
              <Text font="heading" tone="inverse" className="text-[44px] leading-[52px]">
                {formatMoney(bill.total, false)}{' '}
                <Text font="heading" tone="inverse" className="text-lg">
                  {t('common.etb')}
                </Text>
              </Text>
            </View>
            <HeroChip
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingVertical: 5,
                marginTop: 4,
              }}
            >
              <Lock size={14} color="#FFFFFF" strokeWidth={2.4} />
              <Text font="bold" tone="inverse" className="shrink text-[13px]">
                {t('bills.lockedPrice')}
              </Text>
            </HeroChip>
          </HeroCard>

          {bill.type === 'dine' ? null : (
            <GlassCard style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
              <View className="flex-1">
                {heroLabel ? (
                  <Text font="bold" tone="muted" className="text-[13px] uppercase">
                    {heroLabel}
                  </Text>
                ) : null}
                <Text font="heading" className="text-lg" numberOfLines={2}>
                  {heroName}
                </Text>
              </View>
            </GlassCard>
          )}

          <View className="flex-row items-center justify-between gap-3">
            <Text font="bold" className="text-base" accessibilityRole="header">
              {t('bills.items', { count: itemCount })}
            </Text>
            <View className="flex-row items-center gap-2">
              {bill.type === 'dine' && heroLabel ? (
                <Text tone="muted" className="text-sm" numberOfLines={1}>
                  {heroLabel}
                </Text>
              ) : null}
              <BillPill bill={bill} />
            </View>
          </View>

          {bill.orders?.map((order) => (
            <OrderBlock
              key={order.id}
              order={order}
              canChange={canChange(order)}
              onEdit={() => setEditing(order)}
              onCancel={() => askCancel(order)}
            />
          ))}

          {!bill.orders || hasFees ? (
            <GlassCard style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
              {(bill.orders ? [] : bill.items).map((item, i) => (
                <View
                  key={item.itemId}
                  accessible
                  className={`flex-row items-center gap-3 py-3 ${i > 0 ? 'border-t border-black/[0.07]' : ''}`}
                >
                  <Qty n={item.quantity} />
                  <Text font="bold" className="flex-1 text-base">
                    {item.name}
                  </Text>
                  <MoneyText
                    value={item.priceEtb * item.quantity}
                    showCurrency={false}
                    font="heading"
                    className="text-base"
                  />
                </View>
              ))}
              {hasFees ? (
                <>
                  <FeeRow label={t('bills.foodTotal')} value={bill.foodTotal} />
                  <FeeRow
                    label={t('bills.packing')}
                    note={t('bills.packingNote')}
                    value={bill.packingFee}
                  />
                  {bill.type === 'delivery' ? (
                    <FeeRow label={t('bills.deliveryFee')} value={bill.deliveryFee} />
                  ) : null}
                </>
              ) : null}
            </GlassCard>
          ) : null}

          {canAct ? null : (
            <View className="flex-row items-start gap-2 rounded-[16px] bg-warnBg px-3.5 py-3">
              <Info size={20} color={colors.warnFg} strokeWidth={2.2} />
              <Text font="semibold" className="flex-1 text-[15px] leading-5 text-warnFg">
                {t('bills.othersBill', { name: bill.waiterName })}
              </Text>
            </View>
          )}
        </ScrollView>

        {canAct && open ? (
          <StickyFooter>
            <PrimaryButton
              label={t('bills.payByBank')}
              icon={ScanLine}
              onPress={() =>
                router.push({ pathname: '/verify-restaurant', params: { billId: bill.id } })
              }
            />
            <View className="flex-row gap-2.5">
              <View className="flex-1">
                <GhostButton
                  label={t('bills.paidByCash')}
                  icon={Banknote}
                  onPress={() =>
                    router.push({ pathname: '/bills/[id]/cash', params: { id: bill.id } })
                  }
                />
              </View>
              {bill.orders ? (
                <View className="flex-1">
                  <GhostButton
                    label={t('bills.addMore')}
                    icon={Plus}
                    onPress={() =>
                      router.push({ pathname: '/bills/[id]/add', params: { id: bill.id } })
                    }
                  />
                </View>
              ) : null}
            </View>
          </StickyFooter>
        ) : null}

        {editing ? (
          <EditOrderSheet
            order={editing}
            saving={change.isPending}
            onSave={(items) => change.mutate({ orderId: editing.id, items })}
            onClose={() => setEditing(null)}
          />
        ) : null}
        <ErrorDialog
          visible={change.isError || cancel.isError}
          title={t('common.error')}
          message={t(errorMessageKey(change.error ?? cancel.error))}
          actionLabel={t('errors.retry')}
          onClose={() => {
            change.reset();
            cancel.reset();
          }}
        />
      </SafeAreaView>
    </ScreenBackground>
  );
}

/** One order on the bill: its lines, and Change / Cancel while the kitchen has not started. */
function OrderBlock({
  order,
  canChange,
  onEdit,
  onCancel,
}: {
  order: BillOrder;
  canChange: boolean;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const brand = useBrandColors();
  const struck = order.cancelled ? 'line-through opacity-50' : '';
  return (
    <GlassCard style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
      <View className="flex-row flex-wrap items-center justify-between gap-2 pb-1">
        <Text font="bold" tone="muted" className="text-[13px] uppercase">
          {t('bills.change.order', { number: order.number })}
          {order.edited && !order.cancelled ? ` · ${t('bills.change.edited')}` : ''}
        </Text>
        {order.cancelled ? (
          <Text font="bold" className="text-[15px] text-dangerFg">
            {t('bills.change.cancelled')}
            {order.cancelReason ? ` · ${order.cancelReason}` : ''}
          </Text>
        ) : null}
      </View>
      {order.items.map((item, i) => (
        <View
          key={`${order.id}-${i}`}
          accessible
          className={`flex-row items-center gap-2.5 py-2.5 ${i > 0 ? 'border-t border-black/[0.07]' : ''}`}
        >
          <Qty n={item.quantity} struck={struck} />
          <Text font="semibold" className={`flex-1 text-[15px] ${struck}`}>
            {item.name}
          </Text>
          <MoneyText
            value={item.priceEtb * item.quantity}
            showCurrency={false}
            font="heading"
            className={`text-[15px] ${struck}`}
          />
        </View>
      ))}
      {canChange ? (
        <View className="flex-row gap-2 pb-1 pt-2">
          <GlassCard
            radius={22}
            onPress={onEdit}
            containerStyle={{ flex: 1 }}
            style={styles.smallButton}
          >
            <Pencil size={16} color={brand.primaryText} strokeWidth={2.2} />
            <Text font="bold" className="text-sm" style={{ color: brand.primaryText }}>
              {t('bills.change.edit')}
            </Text>
          </GlassCard>
          <GlassCard
            radius={22}
            onPress={onCancel}
            containerStyle={{ flex: 1 }}
            style={styles.smallButton}
          >
            <X size={16} color={colors.dangerFg} strokeWidth={2.4} />
            <Text font="bold" className="text-sm" style={{ color: colors.dangerFg }}>
              {t('bills.change.cancel')}
            </Text>
          </GlassCard>
        </View>
      ) : !order.cancelled && order.kitchenStatus !== 'new' ? (
        <Text tone="muted" className="pb-1 text-sm">
          {t('bills.change.cooking')}
        </Text>
      ) : null}
    </GlassCard>
  );
}

export default function TableBillScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({ queryKey: billKey(id), queryFn: () => getBill(id) });
  const { refetch } = query;
  // Fresh totals and status when coming back (e.g. after the kitchen marked it served).
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  if (query.isPending) return <LoadingView />;
  if (query.isError && !query.data && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void refetch()} />;
  }
  const bill = query.data;
  if (!bill) {
    return (
      <ScreenBackground>
        <SafeAreaView className="flex-1">
          <View className="px-4 pt-2">
            <TopBar
              title={t('bills.title')}
              left={{
                icon: ChevronLeft,
                onPress: () => router.replace('/bills'),
                label: t('common.back'),
              }}
            />
          </View>
          <Text tone="muted" className="px-6 pt-10 text-center text-lg">
            {t('bills.notFound')}
          </Text>
        </SafeAreaView>
      </ScreenBackground>
    );
  }
  return <BillView bill={bill} />;
}

const styles = StyleSheet.create({
  smallButton: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
  },
});
