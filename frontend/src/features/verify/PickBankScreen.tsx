import { Redirect, useRouter } from 'expo-router';
import { Check, ChevronLeft, ChevronRight, CircleAlert, Save } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BankBadge } from '@/components/ui/BankBadge';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { LoadingView } from '@/components/ui/LoadingView';
import { formatMoney } from '@/components/ui/MoneyText';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { TopBar } from '@/components/ui/TopBar';
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
import { PrimaryButton, SecondaryButton } from '@/ui/glass';

/** Big glass tile for a most-used bank: 64 px badge and its short name. */
function BigBankButton({ bank, onPress }: { bank: PayerBank; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    // The wrapper takes the equal share of the row; a flex on the pressable card is not applied.
    <View className="flex-1">
      <GlassCard
        onPress={onPress}
        accessibilityLabel={`${bank.labelKey ? t(bank.labelKey) : bank.name}, ${t('verifyBank.canCheck')}`}
        style={{ alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 }}
      >
        <BankBadge code={bank.code} size={64} />
        <Text font="bold" className="text-base" numberOfLines={1}>
          {bank.shortName}
        </Text>
      </GlassCard>
    </View>
  );
}

/** One row of the other-banks list: badge, name and a green "✓ Can check" tag. */
function BankRow({
  bank,
  onPress,
  first,
}: {
  bank: PayerBank;
  onPress: () => void;
  first?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${bank.labelKey ? t(bank.labelKey) : bank.name}, ${t('verifyBank.canCheck')}`}
      className={`min-h-[60px] flex-row items-center gap-3 active:opacity-70 ${
        first ? '' : 'border-t border-black/[0.07]'
      }`}
    >
      <BankBadge code={bank.code} size={40} />
      <Text font="bold" className="flex-1 text-base" numberOfLines={2}>
        {bank.labelKey ? t(bank.labelKey) : bank.name}
      </Text>
      <View className="h-7 flex-row items-center gap-1 rounded-[14px] bg-successBg px-2.5">
        <Check size={13} color={colors.successFg} strokeWidth={2.8} />
        <Text font="bold" className="text-[13px]" style={{ color: colors.successFg }}>
          {t('verifyBank.canCheck')}
        </Text>
      </View>
    </Pressable>
  );
}

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
    // Awash: the link is pasted from the SMS, no receipt picture.
    router.push(bank.pasteOnly ? '/verify-bank/found' : '/verify-bank/receipt');
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
    <ScreenBackground>
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="px-4 pb-3 pt-2">
          <TopBar
            title={t('verifyBank.title')}
            subtitle={`${t('verifyBank.payByBank')} · ${formatMoney(amount)}`}
            left={{ icon: ChevronLeft, onPress: goBack, label: t('common.back') }}
          />
        </View>
        <VerifySteps current={1} />

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}>
          <Text font="heading" className="pt-3 text-xl" accessibilityRole="header">
            {t('verifyBank.whichBank')}
          </Text>
          <View className="flex-row gap-2.5">
            {mostUsed.map((bank) => (
              <BigBankButton key={bank.code} bank={bank} onPress={() => pick(bank)} />
            ))}
          </View>

          <Text
            font="bold"
            className="px-1 pt-2 text-[13px] uppercase tracking-[0.6px]"
            style={{ color: colors.muted }}
          >
            {t('verifyBank.otherBanks')}
          </Text>
          <GlassCard style={{ paddingHorizontal: 14 }}>
            {others.map((bank, i) => (
              <BankRow key={bank.code} bank={bank} first={i === 0} onPress={() => pick(bank)} />
            ))}
            <Pressable
              onPress={() => setNotSupported(true)}
              accessibilityRole="button"
              className="min-h-[60px] flex-row items-center gap-3 border-t border-black/[0.07] active:opacity-70"
            >
              <View className="h-10 w-10 items-center justify-center rounded-[14px] bg-[#9A9095]">
                <Text font="bold" tone="inverse" className="text-base">
                  ?
                </Text>
              </View>
              <Text font="bold" className="flex-1 text-base">
                {t('verifyBank.otherBank')}
              </Text>
              <ChevronRight size={20} color="#8A8085" strokeWidth={2.2} />
            </Pressable>
          </GlassCard>
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
          <PrimaryButton
            label={t('verifyBank.chooseAnother')}
            onPress={() => setNotSupported(false)}
          />
          {mode === 'restaurant' ? (
            <SecondaryButton
              label={t('verifyBank.saveNotChecked')}
              icon={Save}
              size="md"
              disabled={!bill}
              onPress={saveNotChecked}
            />
          ) : null}
        </BottomSheet>
      </SafeAreaView>
    </ScreenBackground>
  );
}
