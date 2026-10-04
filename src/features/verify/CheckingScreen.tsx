import { Redirect, useRouter } from 'expo-router';
import { Check, Landmark } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { SmallSpinner, SpinnerRing } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { mockDelay } from '@/lib/api/mock';
import { verifyPayment } from '@/lib/api/verify';
import { formatAmount, parseAmount } from '@/lib/format';
import { colors } from '@/theme/tokens';

import { useVerifyFlow } from './verifyFlow';

type Stage = 'bank' | 'compare' | 'error';
type StepState = 'done' | 'active' | 'todo';

function Step({ state, label, detail }: { state: StepState; label: string; detail?: string }) {
  return (
    <View className="flex-row items-center gap-3.5">
      {state === 'done' ? (
        <View className="h-9 w-9 items-center justify-center rounded-full bg-primary">
          <Check size={20} color={colors.surface} strokeWidth={3} />
        </View>
      ) : state === 'active' ? (
        <SmallSpinner />
      ) : (
        <View className="h-9 w-9 rounded-full border-[3px] border-borderMid" />
      )}
      <View className="flex-1">
        <Text font="bold" className={`text-lg ${state === 'todo' ? 'text-placeholder' : ''}`}>
          {label}
        </Text>
        {detail ? (
          <Text tone="muted" className="text-sm">
            {detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function CheckingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { account, amountInput, qrData, setResult } = useVerifyFlow();
  const amount = parseAmount(amountInput);
  const [stage, setStage] = useState<Stage>('bank');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!account || !qrData) return;
    let cancelled = false;

    verifyPayment({ account, amount, qrData })
      .then(async (result) => {
        if (cancelled) return;
        setStage('compare');
        await mockDelay(700);
        if (cancelled) return;
        setResult(result);
        router.replace('/payment-result');
      })
      .catch(() => {
        if (!cancelled) setStage('error');
      });

    return () => {
      cancelled = true;
    };
  }, [account, amount, qrData, attempt, router, setResult]);

  if (!account || !qrData) return <Redirect href="/verify" />;

  const retry = () => {
    setStage('bank');
    setAttempt((n) => n + 1);
  };

  return (
    <SafeAreaView
      className="flex-1 bg-background"
      accessibilityLiveRegion="polite"
      accessibilityLabel={t('verify.checking.title')}
    >
      <View className="flex-1 items-center justify-center gap-[22px] px-6">
        <SpinnerRing size={170}>
          <Landmark size={52} color={colors.primary} strokeWidth={1.8} />
        </SpinnerRing>

        <View className="items-center">
          <Text font="heading" className="text-center text-[26px]" accessibilityRole="header">
            {t('verify.checking.title')}
          </Text>
          <Text tone="muted" className="mt-1.5 text-center text-[17px]">
            {t('verify.checking.subtitle')}
          </Text>
        </View>

        <View className="w-full flex-row items-center justify-between rounded-[20px] bg-primary px-[18px] py-3">
          <Text font="semibold" tone="inverse" className="text-base">
            {t('verify.checking.waitingFor')}
          </Text>
          <Text font="heading" tone="inverse" className="text-[26px]">
            {formatAmount(amount)} {t('common.etb')}
          </Text>
        </View>

        <View className="w-full gap-4 rounded-[20px] border-[1.5px] border-border bg-surface px-[18px] py-4">
          <Step state="done" label={t('verify.checking.stepScanned')} />
          <Step
            state={stage === 'bank' ? 'active' : stage === 'compare' ? 'done' : 'todo'}
            label={t('verify.checking.stepBank')}
            detail={account.bankName}
          />
          <Step
            state={stage === 'compare' ? 'active' : 'todo'}
            label={t('verify.checking.stepCompare')}
          />
        </View>
      </View>

      <View className="px-6 pb-8">
        {stage === 'error' ? (
          <View className="gap-3">
            <Text font="semibold" className="text-center text-base text-dangerFg">
              {t('verify.checking.error')}
            </Text>
            <Button label={t('verify.result.tryAgain')} onPress={retry} />
          </View>
        ) : (
          <Text font="semibold" tone="muted" className="text-center text-[15px]">
            {t('verify.checking.takesSeconds')}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}
