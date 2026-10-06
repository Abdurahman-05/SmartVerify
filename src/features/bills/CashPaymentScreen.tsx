import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Banknote, HandCoins, Info, Lock, Undo2, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { FormScreen } from '@/components/ui/FormScreen';
import { formatMoney, MoneyText } from '@/components/ui/MoneyText';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { usePayments } from '@/features/payments/store';
import { billLabel } from '@/features/verify/billLabel';
import { calcCash, type ExtraChoice } from '@/features/verify/calcPayment';
import { parseAmountInput } from '@/lib/format';
import { colors } from '@/theme/tokens';

import { useBills } from './store';
import type { Bill } from './types';

function saveCashPayment(bill: Bill, cash: number, tip: number) {
  useBills.getState().markPaid(bill.id);
  usePayments.getState().addPayment({
    id: `pay-${Date.now()}`,
    billId: bill.id,
    method: 'cash',
    cash,
    bank: 0,
    tip,
    waiterId: bill.waiterId,
    waiterName: bill.waiterName,
    createdAt: new Date().toISOString(),
  });
}

function ChoiceButton({
  label,
  icon: Icon,
  selected,
  onPress,
}: {
  label: string;
  icon: LucideIcon;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={`h-[68px] flex-1 flex-row items-center justify-center gap-2 rounded-[18px] px-2 ${
        selected ? 'border-[3px] border-primary bg-primarySoft' : 'border-2 border-borderStrong bg-surface'
      }`}
    >
      <Icon size={22} color={colors.primary} strokeWidth={2.2} />
      <Text font="bold" className="text-[17px]">
        {label}
      </Text>
    </Pressable>
  );
}

function SummaryRow({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  const style = highlight ? { color: colors.tipOnDark } : undefined;
  return (
    <View className="flex-row items-baseline justify-between gap-3" accessible>
      <Text font={highlight ? 'bold' : 'semibold'} tone="inverse" className="flex-1 text-[17px]" style={style}>
        {label}
      </Text>
      <MoneyText value={value} font={highlight ? 'bold' : 'semibold'} tone="inverse" className="text-[17px]" style={style} />
    </View>
  );
}

export default function CashPaymentScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bill = useBills((s) => s.bills.find((b) => b.id === id));
  const [cash, setCash] = useState(0);
  const [extraChoice, setExtraChoice] = useState<ExtraChoice>('tip');
  const [submitted, setSubmitted] = useState(false);

  if (!bill) return <Redirect href="/bills" />;
  if (bill.status === 'paid' && !submitted) return <Redirect href={{ pathname: '/bills/[id]', params: { id: bill.id } }} />;

  const calc = calcCash({ total: bill.total, cash, extraChoice });
  const itemCount = bill.items.reduce((sum, l) => sum + l.quantity, 0);

  const confirm = () => {
    if (!calc.valid) return;
    setSubmitted(true);
    saveCashPayment(bill, cash, calc.tip);
    router.replace({ pathname: '/bills/[id]/cash-saved', params: { id: bill.id } });
  };

  return (
    <FormScreen>
      <ScreenHeader
        title={t('cash.title')}
        subtitle={billLabel(t, bill)}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/bills'))}
      />

      <View className="gap-[18px] px-4 pt-2">
        <View className="gap-1.5">
          <Text font="semibold" tone="muted" className="text-sm">
            {t('cash.billFromOrder', { count: itemCount })}
          </Text>
          <View
            accessible
            accessibilityLabel={t('cash.totalLocked', { amount: formatMoney(bill.total) })}
            className="h-16 flex-row items-center gap-3 rounded-input border-2 border-borderStrong bg-neutralBg px-[18px]"
          >
            <Text font="bold" tone="muted" className="text-[17px]">
              {t('common.etb')}
            </Text>
            <MoneyText value={bill.total} showCurrency={false} className="flex-1 text-right text-[28px]" />
            <Lock size={22} color={colors.muted} strokeWidth={2.2} />
          </View>
        </View>

        <View className="gap-1.5">
          <Text font="bold" className="text-[17px]">
            {t('cash.cashGave')}
          </Text>
          <View
            className={`h-16 flex-row items-center gap-3 rounded-input border-2 bg-surface px-[18px] ${
              cash > 0 && !calc.valid ? 'border-dangerFg' : 'border-borderStrong'
            }`}
          >
            <Banknote size={22} color={colors.muted} strokeWidth={2.2} />
            <Text font="bold" tone="muted" className="text-[17px]">
              {t('common.etb')}
            </Text>
            <TextInput
              value={cash ? formatMoney(cash, false) : ''}
              onChangeText={(text) => setCash(parseAmountInput(text))}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.placeholder}
              accessibilityLabel={t('cash.cashLabel')}
              className="h-full flex-1 text-right font-heading text-[28px] text-text"
            />
          </View>
        </View>

        {calc.extra > 0 ? (
          <View className="gap-1.5">
            <Text font="bold" className="text-[17px]">
              {t('cash.extraQuestion', { amount: formatMoney(calc.extra) })}
            </Text>
            <View className="flex-row gap-2" accessibilityRole="radiogroup">
              <ChoiceButton
                label={t('cash.waiterTip')}
                icon={HandCoins}
                selected={extraChoice === 'tip'}
                onPress={() => setExtraChoice('tip')}
              />
              <ChoiceButton
                label={t('cash.giveBack')}
                icon={Undo2}
                selected={extraChoice === 'giveback'}
                onPress={() => setExtraChoice('giveback')}
              />
            </View>
          </View>
        ) : null}

        {calc.valid ? (
          <View className="gap-1 rounded-[20px] bg-primary px-[18px] py-3">
            {calc.tip > 0 ? (
              <>
                <SummaryRow label={t('cash.toRestaurant')} value={bill.total} />
                <SummaryRow label={t('cash.tipFor', { name: bill.waiterName })} value={calc.tip} highlight />
              </>
            ) : (
              <>
                <SummaryRow label={t('cash.totalBill')} value={bill.total} />
                <SummaryRow label={t('cash.cashReceived')} value={cash} />
              </>
            )}
            {calc.change > 0 ? (
              <View className="mt-1.5 border-t-2 border-white/35 pt-2" accessible>
                <Text font="semibold" tone="inverse" className="text-base">
                  {t('cash.giveBackToCustomer')}
                </Text>
                <MoneyText value={calc.change} tone="inverse" className="text-4xl" />
              </View>
            ) : null}
          </View>
        ) : null}

        <View className="flex-row items-start gap-2">
          <Info size={20} color={colors.primaryText} strokeWidth={2.2} />
          <Text font="semibold" tone="muted" className="flex-1 text-[15px] leading-5">
            {t('cash.note')}
          </Text>
        </View>
      </View>

      <View className="min-h-6 flex-1" />

      <View className="gap-2 px-4 pb-6 pt-2">
        {cash > 0 && !calc.valid ? (
          <Text font="semibold" className="text-center text-base text-dangerFg" accessibilityLiveRegion="polite">
            {t('cash.missing', { amount: formatMoney(calc.missing) })}
          </Text>
        ) : null}
        <Button label={t('cash.confirm')} icon={Banknote} disabled={!calc.valid} onPress={confirm} />
      </View>
    </FormScreen>
  );
}
