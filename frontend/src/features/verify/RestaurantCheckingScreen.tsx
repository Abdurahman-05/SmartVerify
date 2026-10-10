import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { LoadingView } from '@/components/ui/LoadingView';
import { Text } from '@/components/ui/Text';
import { useBills } from '@/features/bills/store';
import { checkBankPayment } from '@/lib/mock/verify';

import { settlePayment, useRestaurantPay } from './restaurantFlow';
import { useVerifyFlow } from './verifyFlow';

export default function RestaurantCheckingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const billId = useRestaurantPay((s) => s.billId);
  const bill = useBills((s) => s.bills.find((b) => b.id === billId));
  const { account, amount, qrData } = useVerifyFlow();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!bill || !account || !qrData) return;
    let cancelled = false;
    checkBankPayment({ account, expected: amount, qrData, simulate: useRestaurantPay.getState().simulate })
      .then(({ received }) => {
        if (cancelled) return;
        settlePayment(bill, received);
        router.replace('/verify-restaurant/result');
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // Re-run only on retry; bill/flow values are read once per attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  if (!bill || !account || !qrData) return <Redirect href="/bills" />;

  if (failed) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-background px-6">
        <Text font="semibold" className="text-center text-lg text-dangerFg">
          {t('verifyRestaurant.checkFailed')}
        </Text>
        <View className="w-full">
          <Button
            label={t('verifyRestaurant.tryAgain')}
            onPress={() => {
              setFailed(false);
              setAttempt((n) => n + 1);
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return <LoadingView title={t('verifyRestaurant.checking')} subtitle={t('verifyRestaurant.checkingSubtitle')} />;
}
