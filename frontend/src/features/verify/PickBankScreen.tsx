import { Redirect, useRouter } from 'expo-router';
import { Check, CircleAlert, CircleHelp, Save } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BankBadge } from '@/components/ui/BankBadge';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { LoadingView } from '@/components/ui/LoadingView';
import { MoneyText } from '@/components/ui/MoneyText';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { usePaymentBill } from '@/features/bills/usePaymentBill';
import { newIdempotencyKey } from '@/lib/api/idempotency';
import { errorMessageKey } from '@/lib/errors';
import { colors } from '@/theme/tokens';

import { payerBanks, type PayerBank } from './payerBanks';
import { startRoute, useReceiptFlow } from './receiptFlow';
import { settlePayment, useRestaurantPay } from './restaurantFlow';
import { useVerifyFlow } from './verifyFlow';
import { VerifySteps } from './VerifySteps';

function SectionLabel({ children }: { children: string }) {
  return (
    <Text font="bold" tone="muted" className="px-4 pb-1.5 pt-3.5 text-sm uppercase tracking-widest">
      {children}
    </Text>
  );
}

function BigBankButton({ bank, onPress }: { bank: PayerBank; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${bank.name}, ${t('verifyBank.canCheck')}`}
      className="h-[138px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[22px] border-2 border-borderStrong bg-surface active:bg-background"
    >
      <BankBadge code={bank.code} size={64} />
      <Text font="bold" className="text-lg">
        {bank.shortName}
      </Text>
      <View className="flex-row items-center gap-1">
        <Check size={14} color={colors.primaryText} strokeWidth={3} />
        <Text font="bold" tone="link" className="text-sm">
          {t('verifyBank.canCheck')}
        </Text>
      </View>
    </Pressable>
  );
}

function SmallBankButton({ bank, onPress }: { bank: PayerBank; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={bank.name}
      className="h-[58px] min-w-0 flex-1 flex-row items-center gap-2.5 rounded-[18px] border-2 border-border bg-surface px-2.5 active:bg-background"
    >
      <BankBadge code={bank.code} size={40} />
      <Text font="bold" className="flex-1 text-base" numberOfLines={2}>
        {bank.shortName}
      </Text>
    </Pressable>
  );
}

/** Pairs for the two-column grid. */
const pairs = <T,>(list: T[]) =>
  Array.from({ length: Math.ceil(list.length / 2) }, (_, i) => list.slice(i * 2, i * 2 + 2));

/** Step 1: which bank the customer paid from (VerifyPickBank + VerifyBankNotSupported). */
export default function PickBankScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const amount = useVerifyFlow((s) => s.amount);
  const setBank = useReceiptFlow((s) => s.setBank);
  const mode = useReceiptFlow((s) => s.mode);
  const billId = useRestaurantPay((s) => s.billId);
  const { bill } = usePaymentBill(billId);
  const [notSupported, setNotSupported] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveKey] = useState(newIdempotencyKey);

  if (amount <= 0) return <Redirect href={startRoute(mode)} />;
  if (saving) return <LoadingView title={t('verifyBank.saving')} />;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace(startRoute(mode)));
  const pick = (bank: PayerBank) => {
    setBank(bank.code);
    router.push('/verify-bank/receipt');
  };

  // Records the bank money without a check (the customer's bank cannot be checked yet).
  // TODO(backend): send it as "not checked" once the server has that status.
  const saveNotChecked = () => {
    if (!bill) return;
    setNotSupported(false);
    setSaving(true);
    settlePayment(bill, amount, saveKey)
      .then(() => router.replace('/verify-restaurant/result'))
      .catch((error: unknown) => {
        setSaving(false);
        Alert.alert(t('common.error'), t(errorMessageKey(error)));
      });
  };

  const mostUsed = payerBanks.filter((b) => b.mostUsed);
  const others = payerBanks.filter((b) => !b.mostUsed);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader
        title={t('verifyBank.title')}
        subtitle={t('verifyBank.whichBank')}
        onBack={goBack}
      />
      <VerifySteps current={1} />
      <View
        className="mx-4 mt-3 flex-row items-center justify-between rounded-2xl bg-primary px-4 py-2.5"
        accessible
      >
        <Text font="semibold" tone="inverse" className="text-[15px]">
          {t('verifyBank.payByBank')}
        </Text>
        <MoneyText value={amount} tone="inverse" className="text-[22px]" />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <SectionLabel>{t('verifyBank.mostUsed')}</SectionLabel>
        <View className="flex-row gap-2.5 px-4">
          {mostUsed.map((bank) => (
            <BigBankButton key={bank.code} bank={bank} onPress={() => pick(bank)} />
          ))}
        </View>

        <SectionLabel>{t('verifyBank.otherBanks')}</SectionLabel>
        <View className="gap-2 px-4">
          {pairs(others).map((row) => (
            <View key={row[0].code} className="flex-row gap-2">
              {row.map((bank) => (
                <SmallBankButton key={bank.code} bank={bank} onPress={() => pick(bank)} />
              ))}
              {row.length === 1 ? <View className="flex-1" /> : null}
            </View>
          ))}
        </View>

        <View className="px-4 pt-2.5">
          <Pressable
            onPress={() => setNotSupported(true)}
            accessibilityRole="button"
            className="h-16 flex-row items-center justify-center gap-2.5 rounded-[20px] border-2 border-dashed border-borderStrong active:bg-surface"
          >
            <CircleHelp size={22} color={colors.text} strokeWidth={2.2} />
            <Text font="bold" className="text-[17px]">
              {t('verifyBank.otherBank')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <BottomSheet visible={notSupported} onClose={() => setNotSupported(false)}>
        <View className="flex-row items-center gap-3.5">
          <View className="h-[60px] w-[60px] items-center justify-center rounded-full bg-tipBg">
            <CircleAlert size={30} color={colors.warnFg} strokeWidth={2.2} />
          </View>
          <View className="flex-1">
            <Text font="heading" className="text-[22px] leading-tight" accessibilityRole="header">
              {t('verifyBank.notSupportedTitle')}
            </Text>
            <Text tone="muted" className="mt-0.5 text-[17px]">
              {t('verifyBank.notSupportedBody')}
            </Text>
          </View>
        </View>
        <Button label={t('verifyBank.chooseAnother')} onPress={() => setNotSupported(false)} />
        {mode === 'restaurant' ? (
          <Button
            label={t('verifyBank.saveNotChecked')}
            icon={Save}
            variant="outline"
            size="md"
            disabled={!bill}
            onPress={saveNotChecked}
          />
        ) : null}
      </BottomSheet>
    </SafeAreaView>
  );
}
