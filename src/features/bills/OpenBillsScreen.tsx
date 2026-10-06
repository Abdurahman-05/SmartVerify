import { useRouter } from 'expo-router';
import { Bike, ChevronRight, Info, ShieldCheck, ShoppingBag } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { formatMoney, MoneyText } from '@/components/ui/MoneyText';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { Pill } from '@/features/orders/Pill';
import { formatTime } from '@/lib/format';
import { useSession } from '@/store/session';
import { colors } from '@/theme/tokens';

import { BillPill } from './BillPill';
import { openBills, useBills } from './store';
import type { Bill } from './types';

function BillTile({ bill }: { bill: Bill }) {
  const { t } = useTranslation();
  return (
    <View className="h-14 w-14 items-center justify-center rounded-input bg-primary">
      {bill.type === 'dine' ? (
        <>
          <Text font="bold" tone="inverse" className="text-sm">
            {t('bills.tableTile')}
          </Text>
          <Text font="heading" tone="inverse" className="text-[22px] leading-6">
            {bill.tableNo}
          </Text>
        </>
      ) : bill.type === 'takeaway' ? (
        <ShoppingBag size={26} color={colors.surface} strokeWidth={2.2} />
      ) : (
        <Bike size={26} color={colors.surface} strokeWidth={2.2} />
      )}
    </View>
  );
}

function useBillLabel() {
  const { t } = useTranslation();
  return (bill: Bill) => {
    const ordered = t('bills.ordered', { time: formatTime(bill.createdAt) });
    if (bill.type === 'dine') {
      return {
        name: t('orders.table', { number: bill.tableNo }),
        detail: bill.guests ? `${t('bills.guests', { count: bill.guests })} · ${ordered}` : ordered,
      };
    }
    const name =
      bill.type === 'takeaway'
        ? `${t('bills.takeaway')} · ${bill.customerName ?? ''}`
        : `${t('bills.delivery')} · ${bill.area ?? ''}`;
    return { name, detail: ordered };
  };
}

export default function OpenBillsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const userId = useSession((s) => s.user?.userId);
  const allBills = useBills((s) => s.bills);
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const labelFor = useBillLabel();

  const open = openBills(allBills);
  const shown = scope === 'mine' ? open.filter((b) => b.waiterId === userId) : open;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader
        title={t('bills.title')}
        subtitle={t('bills.subtitle')}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
      />

      <View className="flex-row gap-2 px-4 pb-2.5 pt-1" accessibilityRole="radiogroup">
        <Pill label={t('bills.myTables')} selected={scope === 'mine'} onPress={() => setScope('mine')} />
        <Pill label={t('bills.allTables')} selected={scope === 'all'} onPress={() => setScope('all')} />
      </View>

      <FlatList
        data={shown}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}
        renderItem={({ item }) => {
          const { name, detail } = labelFor(item);
          return (
            <Pressable
              onPress={() => router.push({ pathname: '/bills/[id]', params: { id: item.id } })}
              accessibilityRole="button"
              accessibilityLabel={t('bills.openBill', { name, amount: formatMoney(item.total) })}
              className="flex-row items-center gap-3 rounded-[18px] border-[1.5px] border-border bg-surface py-2.5 pl-2.5 pr-3 active:bg-primarySoft"
            >
              <BillTile bill={item} />
              <View className="flex-1">
                {item.type !== 'dine' ? (
                  <Text font="bold" className="text-base" numberOfLines={1}>
                    {name}
                  </Text>
                ) : null}
                <Text tone="muted" className="mb-1 text-sm" numberOfLines={1}>
                  {detail}
                </Text>
                <BillPill bill={item} className="self-start" />
              </View>
              <View className="items-end">
                <MoneyText value={item.total} showCurrency={false} className="text-xl" />
                <Text font="bold" tone="muted" className="text-sm">
                  {t('common.etb')}
                </Text>
              </View>
              <ChevronRight size={22} color={colors.muted} strokeWidth={2} />
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text tone="muted" className="px-4 pt-8 text-center text-lg">
            {t('bills.empty')}
          </Text>
        }
      />

      <View className="gap-2.5 px-4 pb-3 pt-1">
        <Button
          label={t('bills.verifyWithoutOrder')}
          icon={ShieldCheck}
          variant="outline"
          size="md"
          onPress={() => router.push('/verify')}
        />
        <View className="flex-row items-start gap-2">
          <Info size={18} color={colors.primaryText} strokeWidth={2.2} />
          <Text font="semibold" tone="muted" className="flex-1 text-sm leading-5">
            {t('bills.listNote')}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
