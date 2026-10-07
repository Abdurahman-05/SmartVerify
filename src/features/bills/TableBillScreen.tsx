import { useLocalSearchParams, useRouter } from 'expo-router';
import { Banknote, Info, Plus, QrCode } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBrandColors } from '@/store/theme';
import { Button } from '@/components/ui/Button';
import { MoneyText } from '@/components/ui/MoneyText';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';

import { BillPill } from './BillPill';
import { useBills } from './store';
import type { Bill } from './types';

function useHeading(bill: Bill) {
  const { t } = useTranslation();
  switch (bill.type) {
    case 'dine':
      return {
        title: t('bills.titleTable', { number: bill.tableNo }),
        heroLabel: [
          bill.tableArea ? t(`orders.area.${bill.tableArea}`) : null,
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

        <View className="mx-4 mt-3 rounded-card border-[1.5px] border-border bg-surface px-4 py-0.5">
          {bill.items.map((item, i) => (
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
          {/* TODO: enable once the order screen can add items to an existing bill. */}
          <Button
            label={t('bills.addMore')}
            icon={Plus}
            variant="outline"
            size="md"
            disabled
            onPress={() => {}}
          />
          <Button
            label={t('bills.paidByCash')}
            icon={Banknote}
            variant="outline"
            size="md"
            disabled={bill.status === 'paid'}
            onPress={() => router.push({ pathname: '/bills/[id]/cash', params: { id: bill.id } })}
          />
          <Button
            label={t('bills.payByBank')}
            icon={QrCode}
            disabled={bill.status === 'paid'}
            onPress={() =>
              router.push({ pathname: '/verify-restaurant', params: { billId: bill.id } })
            }
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function TableBillScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bill = useBills((s) => s.bills.find((b) => b.id === id));

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
