import { Redirect, useRouter } from 'expo-router';
import { Check, HandCoins, Info, QrCode, Receipt, Share2 } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { formatMoney, MoneyText } from '@/components/ui/MoneyText';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { useBills } from '@/features/bills/store';
import type { Bill } from '@/features/bills/types';
import { colors } from '@/theme/tokens';

import { billLabel } from './billLabel';
import { useRestaurantPay, type PaymentOutcome } from './restaurantFlow';
import { useVerifyFlow } from './verifyFlow';

function Hero({ short, children }: { short: boolean; children: ReactNode }) {
  return (
    <View
      accessible
      className={`mx-4 mt-1.5 items-center gap-1 rounded-card px-5 py-[18px] ${short ? 'bg-warnBg' : 'bg-primary'}`}
    >
      <View className={`h-[52px] w-[52px] items-center justify-center rounded-full ${short ? 'bg-text' : 'bg-surface'}`}>
        {short ? (
          <Text font="heading" tone="inverse" className="text-[28px]">
            !
          </Text>
        ) : (
          <Check size={28} color={colors.primary} strokeWidth={3} />
        )}
      </View>
      {children}
    </View>
  );
}

function Row({ label, value, tone, last }: { label: string; value: number; tone?: 'link' | 'danger'; last?: boolean }) {
  return (
    <View
      accessible
      className={`flex-row items-center justify-between gap-3 py-3.5 ${last ? '' : 'border-b-[1.5px] border-divider'}`}
    >
      <Text tone="muted" className="flex-1 text-base">
        {label}
      </Text>
      <MoneyText
        value={value}
        font="bold"
        tone={tone === 'link' ? 'link' : 'default'}
        style={tone === 'danger' ? { color: colors.dangerFg } : undefined}
        className="text-lg"
      />
    </View>
  );
}

function MoneyCard({
  icon: Icon,
  title,
  note,
  value,
  tip,
}: {
  icon: typeof Receipt;
  title: string;
  note: string;
  value: number;
  tip?: boolean;
}) {
  return (
    <View
      accessible
      className={`flex-row items-center gap-3 rounded-[18px] p-3 ${
        tip ? 'border-[2.5px] border-amber bg-tipBg' : 'border-[1.5px] border-border bg-surface'
      }`}
    >
      <View className={`h-12 w-12 items-center justify-center rounded-[14px] ${tip ? 'bg-amber' : 'bg-successBg'}`}>
        <Icon size={24} color={tip ? colors.text : colors.primary} strokeWidth={2.2} />
      </View>
      <View className="flex-1">
        <Text font="bold" className="text-[17px]">
          {title}
        </Text>
        <Text tone="muted" className="text-sm">
          {note}
        </Text>
      </View>
      <Text font="bold" className="text-xl">
        {tip ? '+' : ''}
        <MoneyText value={value} font="bold" className="text-xl" />
      </Text>
    </View>
  );
}

function ResultView({ outcome, bill }: { outcome: PaymentOutcome; bill: Bill }) {
  const { t } = useTranslation();
  const router = useRouter();
  const short = outcome.status === 'short';
  const isCashBank = outcome.method === 'cash+bank';
  const methodLabel = t(`verifyRestaurant.method.${outcome.method}`);
  const subtitle = isCashBank ? methodLabel : `${methodLabel} · ${billLabel(t, bill)}`;

  const done = () => {
    useRestaurantPay.getState().reset();
    useVerifyFlow.getState().finish();
    router.dismissTo('/bills');
  };

  const scanAgain = () => {
    useVerifyFlow.getState().setAmount(outcome.remaining);
    router.replace({ pathname: '/scan', params: { mode: 'restaurant' } });
  };

  const changeCash = () =>
    router.canGoBack()
      ? router.back()
      : router.replace({ pathname: '/verify-restaurant', params: { billId: bill.id } });

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader title={t('verifyRestaurant.resultTitle')} subtitle={subtitle} />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        {short ? (
          <Hero short>
            <Text font="bold" className="mt-1 text-[17px]">
              {t('verifyRestaurant.notFullyPaid')}
            </Text>
            <Text font="semibold" className="text-[15px]">
              {t('verifyRestaurant.stillNeeds')}
            </Text>
            <MoneyText value={outcome.remaining} className="text-4xl" />
          </Hero>
        ) : outcome.status === 'over' ? (
          <Hero short={false}>
            <Text font="bold" tone="inverse" className="mt-1 text-[17px]">
              {t('verifyRestaurant.verified')}
            </Text>
            <MoneyText value={outcome.received} tone="inverse" className="text-4xl" />
            <Text font="semibold" tone="inverse" className="text-[15px]">
              {t('verifyRestaurant.fromBank')}
            </Text>
          </Hero>
        ) : (
          <Hero short={false}>
            <Text font="bold" tone="inverse" className="mt-1 text-[17px]">
              {t('verifyRestaurant.fullyPaid')}
            </Text>
            <MoneyText value={outcome.total} tone="inverse" className="text-4xl" />
            <Text font="semibold" tone="inverse" className="text-[15px]">
              {isCashBank ? t('verifyRestaurant.cashBankMatch') : t('verifyRestaurant.bankMatch')}
            </Text>
          </Hero>
        )}

        {outcome.status === 'over' ? (
          <>
            <Text font="heading" className="px-4 pb-1.5 pt-3.5 text-lg" accessibilityRole="header">
              {t('verifyRestaurant.whereMoneyGoes')}
            </Text>
            <View className="mx-4 gap-2.5">
              <MoneyCard
                icon={Receipt}
                title={t('verifyRestaurant.restaurantBill')}
                note={t('verifyRestaurant.fromOrder')}
                value={outcome.total}
              />
              <MoneyCard
                icon={HandCoins}
                title={t('verifyRestaurant.tipFor', { name: bill.waiterName })}
                note={t('verifyRestaurant.tipNote')}
                value={outcome.tip}
                tip
              />
            </View>
            <View className="mx-4 mt-3 flex-row items-start gap-2">
              <Info size={20} color={colors.primaryText} strokeWidth={2.2} />
              <Text font="semibold" tone="muted" className="flex-1 text-[15px] leading-5">
                {t('verifyRestaurant.tipExplain')}
              </Text>
            </View>
          </>
        ) : (
          <View className="mx-4 mt-3 rounded-card border-[1.5px] border-border bg-surface px-[18px] py-0.5">
            <Row label={t('verifyRestaurant.rowTotal')} value={outcome.total} />
            {outcome.cash > 0 ? <Row label={t('verifyRestaurant.rowCash')} value={outcome.cash} /> : null}
            {short ? <Row label={t('verifyRestaurant.rowBankExpected')} value={outcome.expectedBank} /> : null}
            <Row
              label={t('verifyRestaurant.rowBankReceived')}
              value={outcome.received}
              tone={short ? undefined : 'link'}
            />
            <Row
              label={t('verifyRestaurant.rowStillToPay')}
              value={outcome.remaining}
              tone={short ? 'danger' : 'link'}
              last
            />
          </View>
        )}

        <View className="min-h-6 flex-1" />

        <View className="gap-2.5 px-4 pb-6">
          {short ? (
            <>
              <Button label={t('verifyRestaurant.changeCash')} variant="outline" size="md" onPress={changeCash} />
              <Button
                label={t('verifyRestaurant.scanAgain', { amount: formatMoney(outcome.remaining) })}
                icon={QrCode}
                onPress={scanAgain}
              />
            </>
          ) : (
            <>
              {/* TODO: share a receipt once the receipt format is decided. */}
              <Button
                label={t('verifyRestaurant.shareReceipt')}
                icon={Share2}
                variant="outline"
                size="md"
                onPress={() => {}}
              />
              <Button label={t('verifyRestaurant.done')} onPress={done} />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function RestaurantResultScreen() {
  // Snapshot so resetting the flow on "Done" doesn't blank the screen mid-transition.
  const [outcome] = useState(() => useRestaurantPay.getState().outcome);
  const bill = useBills((s) => s.bills.find((b) => b.id === outcome?.billId));

  if (!outcome || !bill) return <Redirect href="/bills" />;
  return <ResultView outcome={outcome} bill={bill} />;
}
