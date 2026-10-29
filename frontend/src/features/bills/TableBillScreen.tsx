import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Banknote, Info, Pencil, Plus, QrCode, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBrandColors } from '@/store/theme';
import { Button } from '@/components/ui/Button';
import { LoadingView } from '@/components/ui/LoadingView';
import { MoneyText } from '@/components/ui/MoneyText';
import { NoConnection } from '@/components/ui/NoConnection';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
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
      className="flex-row items-center justify-between gap-3 border-t-[1.5px] border-divider py-3"
      accessible
    >
      <View className="flex-1">
        <Text font="semibold" className="text-[17px]">
          {label}
        </Text>
        {note ? (
          <Text tone="muted" className="text-sm">
            {note}
          </Text>
        ) : null}
      </View>
      <MoneyText value={value} font="bold" className="text-[17px]" />
    </View>
  );
}

function BillView({ bill }: { bill: Bill }) {
  const brand = useBrandColors();
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

  // The server decides too (ORDER_LOCKED); this only hides buttons that would fail.
  const canChange = (order: BillOrder) =>
    !order.cancelled && order.kitchenStatus === 'new' && bill.status === 'open' && role !== 'chef';
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

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader
        title={title}
        subtitle={t('bills.orderLine', { number: bill.orderNo, name: bill.waiterName })}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/bills'))}
      />

      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View className="mx-4 mt-1 flex-row items-center justify-between gap-3 rounded-[20px] bg-primary px-[18px] py-3">
          <View className="flex-1">
            {heroLabel ? (
              <Text font="semibold" tone="inverse" className="text-sm opacity-90">
                {heroLabel}
              </Text>
            ) : null}
            <Text font="heading" tone="inverse" className="text-[26px]" numberOfLines={2}>
              {heroName}
            </Text>
          </View>
          <BillPill bill={bill} />
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

        <View
          className={`mx-4 mt-3 rounded-card border-[1.5px] border-border bg-surface px-4 py-0.5 ${
            bill.orders ? (hasFees ? '' : 'hidden') : ''
          }`}
        >
          {(bill.orders ? [] : bill.items).map((item, i) => (
            <View
              key={item.itemId}
              accessible
              className={`flex-row items-center gap-3 py-3 ${i < bill.items.length - 1 ? 'border-b-[1.5px] border-divider' : ''}`}
            >
              <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-primaryTile">
                <Text font="bold" className="text-base text-primary">
                  {item.quantity}×
                </Text>
              </View>
              <Text font="semibold" className="flex-1 text-[17px]">
                {item.name}
              </Text>
              <MoneyText
                value={item.priceEtb * item.quantity}
                showCurrency={false}
                font="bold"
                className="text-[17px]"
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
        </View>

        <View className="mx-4 mt-3 flex-row items-baseline justify-between" accessible>
          <Text font="bold" className="text-lg">
            {t('bills.totalToPay')}
          </Text>
          <Text font="heading" className="text-[30px]">
            <MoneyText value={bill.total} showCurrency={false} className="text-[30px]" />{' '}
            <Text font="heading" className="text-base">
              {t('common.etb')}
            </Text>
          </Text>
        </View>

        <View className="mx-4 mt-2 flex-row items-start gap-2">
          <Info size={20} color={brand.primaryText} strokeWidth={2.2} />
          <Text font="semibold" tone="muted" className="flex-1 text-[15px] leading-5">
            {t('bills.priceNote')}
          </Text>
        </View>

        <View className="min-h-6 flex-1" />

        <View className="gap-2.5 px-4 pb-6">
          <Button
            label={t('bills.addMore')}
            icon={Plus}
            variant="outline"
            size="md"
            disabled={bill.status !== 'open' || !bill.orders}
            onPress={() => router.push({ pathname: '/bills/[id]/add', params: { id: bill.id } })}
          />
          <Button
            label={t('bills.paidByCash')}
            icon={Banknote}
            variant="outline"
            size="md"
            disabled={bill.status !== 'open'}
            onPress={() => router.push({ pathname: '/bills/[id]/cash', params: { id: bill.id } })}
          />
          <Button
            label={t('bills.payByBank')}
            icon={QrCode}
            disabled={bill.status !== 'open'}
            onPress={() =>
              router.push({ pathname: '/verify-restaurant', params: { billId: bill.id } })
            }
          />
        </View>
      </ScrollView>

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
  const struck = order.cancelled ? 'line-through opacity-50' : '';
  return (
    <View className="mx-4 mt-3 rounded-card border-[1.5px] border-border bg-surface px-4 py-2">
      <View className="flex-row flex-wrap items-center justify-between gap-2 pb-1">
        <Text font="bold" tone="muted" className="text-[15px]">
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
        <View key={`${order.id}-${i}`} accessible className="flex-row items-center gap-3 py-2">
          <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-primaryTile">
            <Text font="bold" className={`text-base text-primary ${struck}`}>
              {item.quantity}×
            </Text>
          </View>
          <Text font="semibold" className={`flex-1 text-[17px] ${struck}`}>
            {item.name}
          </Text>
          <MoneyText
            value={item.priceEtb * item.quantity}
            showCurrency={false}
            font="bold"
            className={`text-[17px] ${struck}`}
          />
        </View>
      ))}
      {canChange ? (
        <View className="flex-row gap-2 pb-1 pt-2">
          <View className="flex-1">
            <Button
              label={t('bills.change.edit')}
              icon={Pencil}
              variant="outline"
              size="md"
              onPress={onEdit}
            />
          </View>
          <View className="flex-1">
            <Button
              label={t('bills.change.cancel')}
              icon={X}
              variant="outline"
              size="md"
              onPress={onCancel}
            />
          </View>
        </View>
      ) : !order.cancelled && order.kitchenStatus !== 'new' ? (
        <Text tone="muted" className="pb-1 text-sm">
          {t('bills.change.cooking')}
        </Text>
      ) : null}
    </View>
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
      <SafeAreaView className="flex-1 bg-background">
        <ScreenHeader title={t('bills.title')} onBack={() => router.replace('/bills')} />
        <Text tone="muted" className="px-6 pt-10 text-center text-lg">
          {t('bills.notFound')}
        </Text>
      </SafeAreaView>
    );
  }
  return <BillView bill={bill} />;
}
