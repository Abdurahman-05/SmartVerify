import { Redirect, useRouter } from 'expo-router';
import { Banknote, CircleAlert, HandCoins } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { LoadingView } from '@/components/ui/LoadingView';
import { formatMoney, MoneyText } from '@/components/ui/MoneyText';
import { NoConnection } from '@/components/ui/NoConnection';
import { ResultBadge } from '@/components/ui/ResultBadge';
import { Text } from '@/components/ui/Text';
import { usePaymentBill } from '@/features/bills/usePaymentBill';
import { newIdempotencyKey } from '@/lib/api/idempotency';
import type { ExtraChoice } from '@/lib/api/payments';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { checkBankPayment } from '@/lib/mock/verify';
import {
  boaReceiptIdOf,
  dashenReferenceOf,
  isCbeReceiptLink,
  telebirrNumberOf,
  verifyBoa,
  verifyCbe,
  verifyDashen,
  verifyTelebirr,
  type CbeMismatch,
  type CbeUnable,
} from '@/lib/verification';
import { colors } from '@/theme/tokens';

import { DetailsCard } from './PaymentResultScreen';
import { settlePayment, useRestaurantPay } from './restaurantFlow';
import { useVerifyFlow } from './verifyFlow';

type Failure =
  | { kind: 'network' }
  | { kind: 'error'; messageKey: string }
  | { kind: 'mismatch'; reasons: CbeMismatch[]; reference: string; paid: number }
  | { kind: 'unable'; reason: CbeUnable };

/**
 * Bank money actually received, or why it cannot be counted. A CBE receipt link is checked by the
 * server; anything else (typed values, other banks) still uses the FAKE check for now.
 */
async function checkReceived(
  qrData: string,
  amount: number,
  billId: string,
  fake: () => Promise<number>
): Promise<number | Failure> {
  // CBE receipt links and telebirr numbers are checked by the server; a check that does not
  // verify is saved with the bill, so it shows in history.
  const telebirr = telebirrNumberOf(qrData);
  const dashen = dashenReferenceOf(qrData);
  const boa = boaReceiptIdOf(qrData);
  if (!telebirr && !dashen && !boa && !isCbeReceiptLink(qrData)) return fake();
  const result = telebirr
    ? await verifyTelebirr(telebirr, amount, billId)
    : dashen
      ? await verifyDashen(dashen, amount, billId)
      : boa
        ? await verifyBoa(boa, amount, billId)
        : await verifyCbe(qrData, amount, billId);
  if (result.status === 'verified') return result.amountEtb;
  if (result.status === 'not_matching') {
    return {
      kind: 'mismatch',
      reasons: result.reasons,
      reference: result.reference,
      paid: result.amountEtb,
    };
  }
  return { kind: 'unable', reason: result.reason };
}

export default function RestaurantCheckingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const billId = useRestaurantPay((s) => s.billId);
  const { bill, pending } = usePaymentBill(billId);
  const { account, amount, qrData } = useVerifyFlow();
  const [failure, setFailure] = useState<Failure | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  // More arrived than the bill: the waiter asks the customer before anything is recorded.
  const [extra, setExtra] = useState<{ received: number } | null>(null);
  // One key per action: "Try again" after a lost answer does not count the payment twice.
  const [scanKey] = useState(newIdempotencyKey);
  const [saveKey] = useState(newIdempotencyKey);

  useEffect(() => {
    if (!bill || !account || !qrData) return;
    let cancelled = false;
    const fake = () =>
      checkBankPayment({
        account,
        expected: amount,
        qrData,
        simulate: useRestaurantPay.getState().simulate,
      }).then(({ received }) => received);

    checkReceived(qrData, amount, bill.id, fake)
      .then(async (received) => {
        if (typeof received !== 'number') {
          if (!cancelled) setFailure(received);
          return;
        }
        if (received > amount) {
          if (!cancelled) setExtra({ received });
          return;
        }
        await settlePayment(bill, received, scanKey);
        if (!cancelled) router.replace('/verify-restaurant/result');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setFailure(
          isNetworkError(error)
            ? { kind: 'network' }
            : { kind: 'error', messageKey: errorMessageKey(error) }
        );
      });
    return () => {
      cancelled = true;
    };
    // Re-run only on retry; bill/flow values are read once per attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, bill?.id]);

  if (pending) return <LoadingView />;
  if (!bill || !account || !qrData) return <Redirect href="/bills" />;
  if (saving) return <LoadingView title={t('verifyBank.saving')} />;

  const retry = () => {
    setFailure(null);
    setAttempt((n) => n + 1);
  };
  const scanAgain = () => router.replace('/verify-bank/scan');
  // Records the amount without a check (the bank could not answer).
  // TODO(backend): send it as "not checked" once the server has that status.
  const saveNotChecked = () => {
    setSaving(true);
    settlePayment(bill, amount, saveKey)
      .then(() => router.replace('/verify-restaurant/result'))
      .catch((error: unknown) => {
        setSaving(false);
        setFailure({ kind: 'error', messageKey: errorMessageKey(error) });
      });
  };

  const settleWith = (received: number, choice: ExtraChoice) => {
    setExtra(null);
    setSaving(true);
    settlePayment(bill, received, scanKey, choice)
      .then(() => router.replace('/verify-restaurant/result'))
      .catch((error: unknown) => {
        setSaving(false);
        setFailure(
          isNetworkError(error)
            ? { kind: 'network' }
            : { kind: 'error', messageKey: errorMessageKey(error) }
        );
      });
  };

  if (failure?.kind === 'network') return <NoConnection onRetry={retry} />;

  if (extra) {
    const extraEtb = extra.received - amount;
    return (
      <SafeAreaView className="flex-1 bg-background">
        <BottomSheet visible onClose={() => {}}>
          <View className="items-center gap-2">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-tipBg">
              <HandCoins size={32} color={colors.warnFg} strokeWidth={2.2} />
            </View>
            <Text font="heading" className="text-center text-[22px]" accessibilityRole="header">
              {t('verifyBank.extra.title')}
            </Text>
            <MoneyText value={extraEtb} className="text-4xl" />
            <Text tone="muted" className="text-center text-base">
              {t('verifyBank.extra.body', {
                received: formatMoney(extra.received),
                bill: formatMoney(amount),
                name: bill.waiterName,
              })}
            </Text>
          </View>
          <Button
            label={t('verifyBank.extra.keepTip')}
            icon={HandCoins}
            onPress={() => settleWith(extra.received, 'tip')}
          />
          <Button
            label={t('verifyBank.extra.giveBack')}
            icon={Banknote}
            variant="outline"
            size="md"
            onPress={() => settleWith(extra.received, 'giveback')}
          />
        </BottomSheet>
      </SafeAreaView>
    );
  }

  if (failure) {
    // Same layout as the other failed results (Failed design): badge, title, details, note.
    const expected = { label: t('verify.result.expected'), value: formatMoney(amount) };
    const [first] = failure.kind === 'mismatch' ? failure.reasons : [];
    const title =
      failure.kind === 'mismatch'
        ? first === 'AMOUNT_TOO_LOW' || !first
          ? t('verify.result.amountMismatchTitle')
          : t(`verifyBank.check.titles.${first}`)
        : failure.kind === 'unable'
          ? t('verifyBank.check.unable')
          : t('verifyRestaurant.checkFailed');
    const body =
      failure.kind === 'mismatch'
        ? failure.reasons.map((r) => t(`verifyBank.check.reasons.${r}`)).join(' ')
        : failure.kind === 'unable'
          ? t(`verifyBank.check.unableReasons.${failure.reason}`)
          : t(failure.messageKey);
    const rows =
      failure.kind === 'mismatch'
        ? [
            expected,
            { label: t('verify.result.paid'), value: formatMoney(failure.paid) },
            { label: t('verify.result.reference'), value: failure.reference },
          ]
        : [expected];

    return (
      <SafeAreaView className="flex-1 bg-dangerSurface">
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingTop: 32,
            paddingBottom: 32,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View className="items-center" accessibilityLiveRegion="assertive">
            <ResultBadge success={false} />
            <Text
              font="heading"
              className="mt-5 text-center text-[26px]"
              accessibilityRole="header"
            >
              {title}
            </Text>
            <Text className="mt-2.5 max-w-[300px] text-center text-base leading-6 text-navInactive">
              {body}
            </Text>
          </View>

          <DetailsCard rows={rows} />

          <View className="mt-4 flex-row items-start gap-2.5 px-1">
            <CircleAlert size={18} color={colors.alert} strokeWidth={2} />
            <Text className="flex-1 text-sm leading-5 text-navInactive">
              {t('verifyBank.check.billOpen')}
            </Text>
          </View>

          <View className="min-h-6 flex-1" />

          <View className="gap-3">
            <Button
              label={t('verify.result.tryAgain')}
              variant="danger"
              onPress={failure.kind === 'mismatch' ? scanAgain : retry}
            />
            {failure.kind === 'unable' ? (
              <Button
                label={t('verifyBank.saveNotChecked')}
                variant="secondary"
                size="md"
                onPress={saveNotChecked}
              />
            ) : (
              <Button
                label={t('verify.result.contactSupport')}
                variant="secondary"
                size="md"
                disabled
                onPress={() => {}}
              />
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <LoadingView
      title={t('verifyRestaurant.checking')}
      subtitle={t('verifyRestaurant.checkingSubtitle')}
    />
  );
}
