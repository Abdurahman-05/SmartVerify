import { Redirect, useRouter } from 'expo-router';
import { CircleAlert, CircleX, QrCode, RotateCcw, Save } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { LoadingView } from '@/components/ui/LoadingView';
import { NoConnection } from '@/components/ui/NoConnection';
import { Text } from '@/components/ui/Text';
import { usePaymentBill } from '@/features/bills/usePaymentBill';
import { newIdempotencyKey } from '@/lib/api/idempotency';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { checkBankPayment } from '@/lib/mock/verify';
import { isCbeReceiptLink, verifyCbe, type CbeMismatch, type CbeUnable } from '@/lib/verification';
import { colors } from '@/theme/tokens';

import { settlePayment, useRestaurantPay } from './restaurantFlow';
import { useVerifyFlow } from './verifyFlow';

type Failure =
  | { kind: 'network' }
  | { kind: 'error'; messageKey: string }
  | { kind: 'mismatch'; reasons: CbeMismatch[] }
  | { kind: 'unable'; reason: CbeUnable };

/**
 * Bank money actually received, or why it cannot be counted. A CBE receipt link is checked by the
 * server; anything else (typed values, other banks) still uses the FAKE check for now.
 */
async function checkReceived(
  qrData: string,
  amount: number,
  fake: () => Promise<number>
): Promise<number | Failure> {
  if (!isCbeReceiptLink(qrData)) return fake();
  const result = await verifyCbe(qrData, amount);
  if (result.status === 'verified') return result.amountEtb;
  if (result.status === 'not_matching') return { kind: 'mismatch', reasons: result.reasons };
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

    checkReceived(qrData, amount, fake)
      .then(async (received) => {
        if (typeof received !== 'number') {
          if (!cancelled) setFailure(received);
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

  if (failure?.kind === 'network') return <NoConnection onRetry={retry} />;

  if (failure) {
    const mismatch = failure.kind === 'mismatch';
    const Icon = mismatch ? CircleX : CircleAlert;
    const title =
      failure.kind === 'mismatch'
        ? t('verifyBank.check.notMatching')
        : failure.kind === 'unable'
          ? t('verifyBank.check.unable')
          : t('verifyRestaurant.checkFailed');
    const lines =
      failure.kind === 'mismatch'
        ? failure.reasons.map((r) => t(`verifyBank.check.reasons.${r}`))
        : failure.kind === 'unable'
          ? [t(`verifyBank.check.unableReasons.${failure.reason}`)]
          : [t(failure.messageKey)];

    return (
      <SafeAreaView className={`flex-1 ${mismatch ? 'bg-dangerSurface' : 'bg-background'}`}>
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <View
            className={`h-24 w-24 items-center justify-center rounded-full ${
              mismatch ? 'bg-dangerBg' : 'bg-tipBg'
            }`}
          >
            <Icon size={52} color={mismatch ? colors.dangerFg : colors.warnFg} strokeWidth={2.2} />
          </View>
          <Text font="heading" className="text-center text-[26px]" accessibilityRole="header">
            {title}
          </Text>
          <View className="gap-1.5">
            {lines.map((line) => (
              <Text key={line} font="semibold" tone="muted" className="text-center text-lg">
                {line}
              </Text>
            ))}
          </View>
        </View>
        <View className="gap-2.5 px-4 pb-6">
          {failure.kind === 'mismatch' ? (
            <Button label={t('verifyBank.scan.again')} icon={QrCode} onPress={scanAgain} />
          ) : (
            <Button label={t('verifyRestaurant.tryAgain')} icon={RotateCcw} onPress={retry} />
          )}
          {failure.kind === 'unable' ? (
            <Button
              label={t('verifyBank.saveNotChecked')}
              icon={Save}
              variant="outline"
              size="md"
              onPress={saveNotChecked}
            />
          ) : null}
          {failure.kind !== 'mismatch' ? (
            <Button
              label={t('verifyBank.scan.again')}
              icon={QrCode}
              variant="outline"
              size="md"
              onPress={scanAgain}
            />
          ) : null}
        </View>
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
