import { useMutation } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Banknote, Check, ChevronLeft, Lock } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBackFallback } from '@/hooks/useBackFallback';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { GlassCard } from '@/components/ui/GlassCard';
import { useGlass } from '@/components/ui/glassTokens';
import { HeroCard, HeroChip } from '@/components/ui/HeroCard';
import { IconTile } from '@/components/ui/IconTile';
import { LoadingView } from '@/components/ui/LoadingView';
import { formatMoney } from '@/components/ui/MoneyText';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { StickyFooter } from '@/components/ui/StickyFooter';
import { Text } from '@/components/ui/Text';
import { TopBar } from '@/components/ui/TopBar';
import { usePayments } from '@/features/payments/store';
import { billLabel } from '@/features/verify/billLabel';
import { newIdempotencyKey } from '@/lib/api/idempotency';
import { payBill, USE_MOCK_BILLS } from '@/lib/bills';
import { errorMessageKey } from '@/lib/errors';
import { refreshAfterPayment } from '@/lib/queryClient';
import { colors } from '@/theme/tokens';

import { useBills } from './store';
import type { Bill } from './types';
import { usePaymentBill } from './usePaymentBill';

// Design: docs/design/owner/verify-handoff/screens/17-cash-payment.png

/**
 * Records the cash payment: always exactly the bill total from the order (no typing, no tip,
 * no change). On the server with the backend, plus a local copy for the receipt.
 */
async function saveCashPayment(bill: Bill, key: string) {
  if (USE_MOCK_BILLS) {
    useBills.getState().markPaid(bill.id);
  } else {
    await payBill(bill.id, { method: 'cash', cashEtb: bill.total, extraChoice: 'giveback' }, key);
    refreshAfterPayment();
  }
  usePayments.getState().addPayment({
    id: `pay-${Date.now()}`,
    billId: bill.id,
    method: 'cash',
    cash: bill.total,
    bank: 0,
    tip: 0,
    waiterId: bill.waiterId,
    waiterName: bill.waiterName,
    createdAt: new Date().toISOString(),
  });
}

export default function CashPaymentScreen() {
  const { t } = useTranslation();
  const g = useGlass();
  const router = useRouter();
  useBackFallback('/bills');
  const { id } = useLocalSearchParams<{ id: string }>();
  const { bill, pending } = usePaymentBill(id);
  const [submitted, setSubmitted] = useState(false);
  // One key per cash payment: confirming again after a lost answer pays once.
  const [payKey] = useState(newIdempotencyKey);
  const mutation = useMutation({
    mutationFn: (b: Bill) => saveCashPayment(b, payKey),
    onSuccess: (_result, b) =>
      router.replace({ pathname: '/bills/[id]/cash-saved', params: { id: b.id } }),
    onError: () => setSubmitted(false),
  });

  if (pending || mutation.isPending) return <LoadingView />;
  if (!bill) return <Redirect href="/bills" />;
  if (bill.status === 'paid' && !submitted)
    return <Redirect href={{ pathname: '/bills/[id]', params: { id: bill.id } }} />;

  const itemCount = bill.items.reduce((sum, l) => sum + l.quantity, 0);
  const total = formatMoney(bill.total);

  const confirm = () => {
    setSubmitted(true);
    mutation.mutate(bill);
  };

  return (
    <ScreenBackground>
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="px-4 pb-3 pt-2">
          <TopBar
            title={t('cash.title')}
            subtitle={`${billLabel(t, bill)} · ${t('cash.orderNo', { number: bill.orderNo })}`}
            left={{
              icon: ChevronLeft,
              onPress: () => (router.canGoBack() ? router.back() : router.replace('/bills')),
              label: t('common.back'),
            }}
          />
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 12 }}>
          <HeroCard style={{ alignItems: 'center' }}>
            <View
              accessible
              accessibilityLabel={t('cash.totalLocked', { amount: total })}
              className="items-center"
            >
              <Text
                font="bold"
                tone="inverse"
                className="text-[13px] uppercase tracking-[0.8px] opacity-90"
              >
                {t('cash.toReceive')}
              </Text>
              <Text font="heading" tone="inverse" className="text-[44px] leading-[52px]">
                {formatMoney(bill.total, false)}{' '}
                <Text font="heading" tone="inverse" className="text-lg">
                  {t('common.etb')}
                </Text>
              </Text>
            </View>
            <HeroChip
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingVertical: 5,
                marginTop: 4,
              }}
            >
              <Lock size={14} color="#FFFFFF" strokeWidth={2.4} />
              <Text font="bold" tone="inverse" className="text-[13px]">
                {t('cash.fromOrder')}
              </Text>
            </HeroChip>
          </HeroCard>

          <View className="flex-row items-center justify-between gap-3">
            <Text font="bold" className="text-base" accessibilityRole="header">
              {t('bills.items', { count: itemCount })}
            </Text>
            <Text className="text-sm" style={{ color: colors.muted }} numberOfLines={1}>
              {t('cash.waiter', { name: bill.waiterName })}
            </Text>
          </View>
          <GlassCard style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
            {bill.items.map((item, i) => (
              <View
                key={item.itemId}
                accessible
                className={`flex-row items-center gap-3 py-3 ${i ? 'border-t border-black/[0.07]' : ''}`}
              >
                <View
                  className="h-8 w-8 items-center justify-center rounded-[10px]"
                  style={{ backgroundColor: g.primaryDeep }}
                >
                  <Text font="bold" tone="inverse" className="text-[15px]">
                    {item.quantity}
                  </Text>
                </View>
                <Text font="bold" className="flex-1 text-base">
                  {item.name}
                </Text>
                <Text font="heading" className="text-base">
                  {formatMoney(item.priceEtb * item.quantity, false)}
                </Text>
              </View>
            ))}
          </GlassCard>

          <GlassCard style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
            <IconTile icon={Banknote} tone="green" size={44} radius={14} iconSize={22} />
            <View className="flex-1">
              <Text font="bold" className="text-base">
                {t('cash.take', { amount: total })}
              </Text>
              <Text className="text-sm" style={{ color: colors.muted }}>
                {t('cash.ledgerNote')}
              </Text>
            </View>
          </GlassCard>
        </ScrollView>

        <StickyFooter>
          <PrimaryButton
            label={t('cash.confirmTotal', { amount: total })}
            icon={Check}
            onPress={confirm}
          />
        </StickyFooter>

        <ErrorDialog
          visible={mutation.isError}
          title={t('common.error')}
          message={t(errorMessageKey(mutation.error))}
          actionLabel={t('errors.retry')}
          onClose={mutation.reset}
        />
      </SafeAreaView>
    </ScreenBackground>
  );
}
