import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Share2 } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { MoneyText } from '@/components/ui/MoneyText';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { useBrandColors } from '@/store/theme';
import { usePayments } from '@/features/payments/store';
import { useSession } from '@/store/session';

import { useBills } from './store';

function Row({ label, children, last }: { label: string; children: ReactNode; last?: boolean }) {
  return (
    <View
      accessible
      className={`flex-row items-center justify-between gap-3 py-3.5 ${last ? '' : 'border-b-[1.5px] border-divider'}`}
    >
      <Text tone="muted" className="flex-1 text-base">
        {label}
      </Text>
      {children}
    </View>
  );
}

export default function CashSavedScreen() {
  const brand = useBrandColors();
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bill = useBills((s) => s.bills.find((b) => b.id === id));
  const payment = usePayments((s) =>
    [...s.payments].reverse().find((p) => p.billId === id && p.method === 'cash')
  );
  const recordedBy = useSession((s) => s.user?.displayName ?? '');

  if (!bill || !payment) return <Redirect href="/bills" />;

  const change = payment.cash - bill.total - payment.tip;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader title={t('cash.resultTitle')} subtitle={t('cash.resultMethod')} />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View
          accessible
          className="mx-4 mt-1.5 items-center gap-1 rounded-card bg-primary px-5 py-[18px]"
        >
          <View className="h-[52px] w-[52px] items-center justify-center rounded-full bg-surface">
            <Check size={28} color={brand.primary} strokeWidth={3} />
          </View>
          <Text font="bold" tone="inverse" className="mt-1 text-[17px]">
            {t('cash.saved')}
          </Text>
          <MoneyText value={bill.total} tone="inverse" className="text-4xl" />
          <Text font="semibold" tone="inverse" className="text-[15px]">
            {t('cash.addedToLedger')}
          </Text>
        </View>

        <View className="mx-4 mt-3 rounded-card border-[1.5px] border-border bg-surface px-[18px] py-0.5">
          <Row label={t('cash.totalBill')}>
            <MoneyText value={bill.total} font="bold" className="text-lg" />
          </Row>
          <Row label={t('cash.cashReceived')}>
            <MoneyText value={payment.cash} font="bold" className="text-lg" />
          </Row>
          {change > 0 ? (
            <Row label={t('cash.givenBack')}>
              <MoneyText value={change} font="bold" className="text-lg" />
            </Row>
          ) : null}
          {payment.tip > 0 ? (
            <Row label={t('cash.tipFor', { name: payment.waiterName })}>
              <MoneyText value={payment.tip} font="bold" tone="link" className="text-lg" />
            </Row>
          ) : null}
          <Row label={t('cash.recordedBy')} last>
            <Text font="bold" className="text-lg">
              {recordedBy}
            </Text>
          </Row>
        </View>

        <View className="min-h-6 flex-1" />

        <View className="gap-2.5 px-4 pb-6">
          {/* TODO: share a receipt once the receipt format is decided. */}
          <Button
            label={t('cash.shareReceipt')}
            icon={Share2}
            variant="outline"
            size="md"
            onPress={() => {}}
          />
          <Button label={t('cash.done')} onPress={() => router.dismissTo('/bills')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
