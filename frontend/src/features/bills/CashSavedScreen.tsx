import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Share2 } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBackFallback } from '@/hooks/useBackFallback';
import { LoadingView } from '@/components/ui/LoadingView';
import { formatMoney, MoneyText } from '@/components/ui/MoneyText';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { shareReceipt } from '@/lib/support';
import { useBrandColors } from '@/store/theme';
import { usePayments } from '@/features/payments/store';
import { useSession } from '@/store/session';

import { usePaymentBill } from './usePaymentBill';
import { GlassCard, HeroCard, PrimaryButton, ScreenBg, SecondaryButton } from '@/ui/glass';

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
  useBackFallback('/bills');
  const { id } = useLocalSearchParams<{ id: string }>();
  const { bill, pending } = usePaymentBill(id);
  const payment = usePayments((s) =>
    [...s.payments].reverse().find((p) => p.billId === id && p.method === 'cash')
  );
  const recordedBy = useSession((s) => s.user?.displayName ?? '');

  if (pending) return <LoadingView />;
  if (!bill || !payment) return <Redirect href="/bills" />;

  const change = payment.cash - bill.total - payment.tip;

  return (
    <ScreenBg>
      <SafeAreaView className="flex-1">
        <ScreenHeader title={t('cash.resultTitle')} subtitle={t('cash.resultMethod')} />
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          <HeroCard accessible className="mx-4 mt-1.5 items-center gap-1 px-5 py-[18px]">
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
          </HeroCard>

          <GlassCard className="mx-4 mt-3 px-[18px] py-0.5">
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
          </GlassCard>

          <View className="min-h-6 flex-1" />

          <View className="gap-2.5 px-4 pb-6">
            <SecondaryButton
              label={t('cash.shareReceipt')}
              icon={Share2}
              size="md"
              onPress={() =>
                shareReceipt([
                  `${t('cash.saved')} · ${t('cash.resultMethod')}`,
                  `${t('cash.totalBill')}: ${formatMoney(bill.total)}`,
                  `${t('cash.cashReceived')}: ${formatMoney(payment.cash)}`,
                  change > 0 && `${t('cash.givenBack')}: ${formatMoney(change)}`,
                  payment.tip > 0 &&
                    `${t('cash.tipFor', { name: payment.waiterName })}: ${formatMoney(payment.tip)}`,
                  `${t('cash.recordedBy')}: ${recordedBy}`,
                ])
              }
            />
            <PrimaryButton label={t('cash.done')} onPress={() => router.dismissTo('/bills')} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </ScreenBg>
  );
}
