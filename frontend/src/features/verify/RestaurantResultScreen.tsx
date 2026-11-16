import { Redirect, useRouter } from 'expo-router';
import { Check, Info, ScanLine, Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GhostButton } from '@/components/ui/GhostButton';
import { GlassCard } from '@/components/ui/GlassCard';
import { useGlass } from '@/components/ui/glassTokens';
import { LoadingView } from '@/components/ui/LoadingView';
import { formatMoney } from '@/components/ui/MoneyText';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ResultBadge } from '@/components/ui/ResultBadge';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { StickyFooter } from '@/components/ui/StickyFooter';
import { Text } from '@/components/ui/Text';
import { usePaymentBill } from '@/features/bills/usePaymentBill';
import type { Bill } from '@/features/bills/types';
import { maskedNumberKey } from '@/features/bank-accounts/telebirr';
import { formatTime } from '@/lib/format';
import { colors } from '@/theme/tokens';
import { resultPalette } from '@/ui/glass';

import { billLabel } from './billLabel';
import { findPayerBank } from './payerBanks';
import { useRestaurantPay, type PaymentOutcome } from './restaurantFlow';
import { useReceiptFlow } from './receiptFlow';
import { useVerifyFlow } from './verifyFlow';

// Design: docs/design/owner/verify-handoff/screens/15-result-ok.png, 16-result-not-paid.png

interface RowData {
  label: string;
  value: string;
  tone?: 'tip';
}

/** One glass list of label / value rows with hairlines between them. */
function KeyValueCard({ rows }: { rows: RowData[] }) {
  const g = useGlass();
  return (
    <GlassCard style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
      {rows.map((row, i) => (
        <View
          key={row.label}
          accessible
          className={`flex-row items-center justify-between gap-3 py-3 ${i ? 'border-t border-black/[0.07]' : ''}`}
        >
          <Text className="text-base" style={{ color: colors.muted }}>
            {row.label}
          </Text>
          <Text
            font="bold"
            className="shrink text-right text-base"
            style={{ color: row.tone === 'tip' ? g.primaryText : colors.text }}
            numberOfLines={1}
          >
            {row.value}
          </Text>
        </View>
      ))}
    </GlassCard>
  );
}

/** Receipt details captured when the screen opened (the flow is cleared on Done). */
interface Snapshot {
  bankShort: string | null;
  accountShort: string | null;
  accountCode: string | null;
  accountLast4: string | null;
  reference: string | null;
  at: string;
}

function ResultView({
  outcome,
  bill,
  snap,
}: {
  outcome: PaymentOutcome;
  bill: Bill;
  snap: Snapshot;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const short = outcome.status === 'short';
  const isCashBank = outcome.method === 'cash+bank';
  const m = (v: number) => formatMoney(v, false);

  const done = () => {
    useRestaurantPay.getState().reset();
    useVerifyFlow.getState().finish();
    router.dismissTo('/bills');
  };

  const scanAgain = () => {
    useVerifyFlow.getState().setAmount(outcome.remaining);
    useReceiptFlow.getState().setMode('restaurant');
    router.replace('/verify-bank');
  };

  const changeCash = () =>
    router.canGoBack()
      ? router.back()
      : router.replace({ pathname: '/verify-restaurant', params: { billId: bill.id } });

  const amountRows: RowData[] = [
    { label: t('verifyRestaurant.rowTotal'), value: `${m(outcome.total)} ${t('common.etb')}` },
    ...(outcome.cash > 0 ? [{ label: t('verifyRestaurant.rowCash'), value: m(outcome.cash) }] : []),
    { label: t('verifyRestaurant.rowBankReceived'), value: m(outcome.received) },
    ...(!short && outcome.tip > 0
      ? [
          {
            label: t('verifyRestaurant.tipFor', { name: bill.waiterName }),
            value: m(outcome.tip),
            tone: 'tip' as const,
          },
        ]
      : []),
    ...(!short && outcome.change > 0
      ? [
          {
            label: t('verifyRestaurant.giveBackTitle'),
            value: m(outcome.change),
            tone: 'tip' as const,
          },
        ]
      : []),
  ];
  const account =
    snap.accountShort && snap.accountCode && snap.accountLast4
      ? `${snap.accountShort} ${t(maskedNumberKey(snap.accountCode), { last4: snap.accountLast4 })}`
      : null;
  const bankValue = [snap.bankShort, account].filter(Boolean).join(' → ');
  const detailRows: RowData[] = [
    ...(bankValue ? [{ label: t('verifyRestaurant.rowBank'), value: bankValue }] : []),
    ...(snap.reference ? [{ label: t('verify.result.reference'), value: snap.reference }] : []),
    {
      label: t('verifyRestaurant.rowTime'),
      value: t('verifyRestaurant.todayAt', { time: formatTime(snap.at) }),
    },
  ];

  return (
    <ScreenBackground palette={short ? resultPalette.bad : resultPalette.ok}>
      <SafeAreaView edges={['top']} className="flex-1">
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 24,
            paddingBottom: 190,
            gap: 12,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View accessible accessibilityLiveRegion="assertive" className="items-center gap-1">
            <ResultBadge success={!short} />
            {short ? (
              <>
                <Text
                  font="heading"
                  className="mt-1 text-center text-[30px] leading-9"
                  style={{ color: colors.dangerFg }}
                  accessibilityRole="header"
                >
                  {t('verifyRestaurant.notFullyPaid')}
                </Text>
                <Text
                  className="max-w-[320px] text-center text-base leading-[22px]"
                  style={{ color: colors.muted }}
                >
                  {t('verifyRestaurant.notPaidHelp')}
                </Text>
              </>
            ) : (
              <>
                <Text
                  font="heading"
                  className="text-[34px] leading-[42px]"
                  style={{ color: colors.successFg }}
                  accessibilityRole="header"
                >
                  {t('brand.name')}
                </Text>
                <Text font="bold" className="text-center text-[17px]">
                  {`${outcome.status === 'over' ? t('verifyRestaurant.verified') : t('verifyRestaurant.fullyPaid')} · ${billLabel(t, bill)}`}
                </Text>
                <View
                  className="mt-1.5 flex-row items-center gap-1.5 rounded-[16px] px-3 py-1.5"
                  style={{ backgroundColor: colors.successBg }}
                >
                  <Check size={15} color={colors.successFg} strokeWidth={2.8} />
                  <Text font="bold" className="text-sm" style={{ color: colors.successFg }}>
                    {isCashBank
                      ? t('verifyRestaurant.cashBankMatch')
                      : t('verifyRestaurant.bankMatch')}
                  </Text>
                </View>
              </>
            )}
          </View>

          {short ? (
            <View
              accessible
              className="items-center rounded-[26px] px-4 py-5"
              style={{
                backgroundColor: colors.alert,
                boxShadow: '0 12px 26px rgba(185,28,28,0.28)',
              }}
            >
              <Text
                font="bold"
                tone="inverse"
                className="text-[13px] uppercase tracking-[0.8px] opacity-90"
              >
                {t('verifyRestaurant.stillMissing')}
              </Text>
              <Text font="heading" tone="inverse" className="text-[44px] leading-[52px]">
                {`${m(outcome.remaining)} ${t('common.etb')}`}
              </Text>
            </View>
          ) : null}

          <KeyValueCard rows={amountRows} />
          {short ? null : <KeyValueCard rows={detailRows} />}

          {outcome.status === 'over' ? (
            <View className="flex-row items-start gap-2 px-1">
              <Info size={18} color={colors.muted} strokeWidth={2.2} />
              <Text tone="muted" className="flex-1 text-sm leading-5">
                {t(
                  outcome.change > 0
                    ? 'verifyRestaurant.giveBackExplain'
                    : 'verifyRestaurant.tipExplain'
                )}
              </Text>
            </View>
          ) : null}

          {short && isCashBank ? (
            <Pressable
              onPress={changeCash}
              accessibilityRole="button"
              className="min-h-11 items-center justify-center active:opacity-70"
            >
              <Text font="bold" tone="link" className="text-[15px]">
                {t('verifyRestaurant.changeCash')}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>

        <StickyFooter>
          {short ? (
            <>
              <PrimaryButton
                label={t('verifyRestaurant.paysMore', { amount: formatMoney(outcome.remaining) })}
                icon={ScanLine}
                onPress={scanAgain}
              />
              {/* The bank money is already saved on the bill; it stays open for the rest. */}
              <GhostButton label={t('verifyRestaurant.saveNotFully')} onPress={done} />
            </>
          ) : (
            <>
              <PrimaryButton label={t('verifyRestaurant.done')} onPress={done} />
              {/* TODO: share a receipt once the receipt format is decided. */}
              <GhostButton
                label={t('verifyRestaurant.shareReceipt')}
                icon={Share2}
                onPress={() => {}}
              />
            </>
          )}
        </StickyFooter>
      </SafeAreaView>
    </ScreenBackground>
  );
}

export default function RestaurantResultScreen() {
  // Snapshot so resetting the flow on "Done" doesn't blank the screen mid-transition.
  const [outcome] = useState(() => useRestaurantPay.getState().outcome);
  const [snap] = useState<Snapshot>(() => {
    const { bankCode, found } = useReceiptFlow.getState();
    const account = useVerifyFlow.getState().account;
    return {
      bankShort: findPayerBank(bankCode)?.shortName ?? null,
      accountShort: account?.shortName ?? null,
      accountCode: account?.bankCode ?? null,
      accountLast4: account?.last4 ?? null,
      reference: found.reference ?? found.transactionNumber ?? null,
      at: new Date().toISOString(),
    };
  });
  const { bill, pending } = usePaymentBill(outcome?.billId);

  if (pending) return <LoadingView />;
  if (!outcome || !bill) return <Redirect href="/bills" />;
  return <ResultView outcome={outcome} bill={bill} snap={snap} />;
}
