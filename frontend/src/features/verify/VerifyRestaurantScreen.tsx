import { useQuery } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Banknote,
  ChevronLeft,
  Landmark,
  Lock,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BankBadge } from '@/components/ui/BankBadge';
import { GlassCard } from '@/components/ui/GlassCard';
import { useGlass } from '@/components/ui/glassTokens';
import { HeroCard, HeroChip } from '@/components/ui/HeroCard';
import { LoadingView } from '@/components/ui/LoadingView';
import { NoConnection } from '@/components/ui/NoConnection';
import { formatMoney } from '@/components/ui/MoneyText';
import { OptionSheet } from '@/components/ui/OptionSheet';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { Segmented } from '@/components/ui/Segmented';
import { StickyFooter } from '@/components/ui/StickyFooter';
import { TopBar } from '@/components/ui/TopBar';
import { Text } from '@/components/ui/Text';
import { maskedNumberKey } from '@/features/bank-accounts/telebirr';
import { usePaymentBill } from '@/features/bills/usePaymentBill';
import { newIdempotencyKey } from '@/lib/api/idempotency';
import { errorMessageKey } from '@/lib/errors';
import { Pill } from '@/features/orders/Pill';
import { parseAmountInput } from '@/lib/format';
import { getBankAccounts } from '@/lib/bankAccounts';
import {
  SIMULATED_OVER_ETB,
  SIMULATED_SHORT_ETB,
  type BankCheckSimulation,
} from '@/lib/mock/verify';
import { colors } from '@/theme/tokens';

import { billLabel } from './billLabel';
import { cashFor, settlePayment, useRestaurantPay, type RestaurantMethod } from './restaurantFlow';
import { useReceiptFlow } from './receiptFlow';
import { useVerifyFlow } from './verifyFlow';

const methods: { value: RestaurantMethod; icon: LucideIcon }[] = [
  { value: 'bank', icon: Landmark },
  { value: 'cash+bank', icon: Wallet },
];

export default function VerifyRestaurantScreen() {
  const { t } = useTranslation();
  const g = useGlass();
  const router = useRouter();
  const { billId } = useLocalSearchParams<{ billId: string }>();
  const { bill, pending } = usePaymentBill(billId);
  const pay = useRestaurantPay();
  const [settling, setSettling] = useState(false);
  const [settleKey] = useState(newIdempotencyKey);
  const { account: chosenAccount, setAccount, setAmount } = useVerifyFlow();
  const [accountSheet, setAccountSheet] = useState(false);
  const {
    data: accounts,
    isError: accountsFailed,
    refetch: refetchAccounts,
  } = useQuery({ queryKey: ['bank-accounts'], queryFn: getBankAccounts });

  const { start } = pay;
  useEffect(() => {
    if (billId && pay.billId !== billId) start(billId);
  }, [billId, pay.billId, start]);

  if (pending || settling) return <LoadingView />;
  if (!bill) return <Redirect href="/bills" />;
  if (accountsFailed && !accounts) {
    return <NoConnection fullPage onRetry={() => void refetchAccounts()} />;
  }
  if (!accounts) return <LoadingView />;

  const account = accounts.find((a) => a.id === chosenAccount?.id) ?? accounts[0];
  const cash = cashFor(pay.method, pay.cash);
  const cashTooMuch = pay.method === 'cash+bank' && cash >= bill.total;
  const toScan = Math.max(bill.total - cash - pay.bankReceived, 0);
  const canGo = Boolean(account) && !cashTooMuch && bill.status === 'open';

  const proceed = () => {
    if (!account) return;
    setAccount(account);
    if (toScan === 0) {
      // Earlier scans already cover the bill: just close it.
      setSettling(true);
      settlePayment(bill, 0, settleKey)
        .then(() => router.push('/verify-restaurant/result'))
        .catch((error: unknown) => Alert.alert(t('common.error'), t(errorMessageKey(error))))
        .finally(() => setSettling(false));
      return;
    }
    setAmount(toScan);
    useReceiptFlow.getState().setMode('restaurant');
    router.push('/verify-bank');
  };

  const simulations: { value: BankCheckSimulation; label: string }[] = [
    { value: 'exact', label: t('verifyRestaurant.devExact') },
    { value: 'over', label: t('verifyRestaurant.devOver', { amount: SIMULATED_OVER_ETB }) },
    { value: 'short', label: t('verifyRestaurant.devShort', { amount: SIMULATED_SHORT_ETB }) },
  ];

  return (
    <ScreenBackground>
      <SafeAreaView edges={['top']} className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          <View className="px-4 pb-3 pt-2">
            <TopBar
              title={t('verifyRestaurant.title')}
              subtitle={billLabel(t, bill)}
              left={{
                icon: ChevronLeft,
                onPress: () => (router.canGoBack() ? router.back() : router.replace('/bills')),
                label: t('common.back'),
              }}
            />
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 12 }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="gap-2">
              <Text font="bold" className="px-1 text-sm" style={{ color: colors.muted }}>
                {t('verifyRestaurant.howPaying')}
              </Text>
              <Segmented<RestaurantMethod>
                options={methods.map(({ value, icon }) => ({
                  value,
                  icon,
                  label: t(`verifyRestaurant.method.${value}`),
                }))}
                value={pay.method}
                onChange={(value) => pay.setMethod(value)}
              />
            </View>

            {pay.method === 'cash+bank' ? (
              <View className="gap-2">
                <Text font="bold" className="px-1 text-sm" style={{ color: colors.muted }}>
                  {t('verifyRestaurant.cashGave')}
                </Text>
                <View
                  className="h-14 flex-row items-center gap-3 rounded-[28px] px-5"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.85)',
                    borderWidth: 2,
                    borderColor: cashTooMuch ? colors.dangerFg : g.primary,
                  }}
                >
                  <Banknote size={22} color={g.primaryText} strokeWidth={2.2} />
                  <TextInput
                    value={pay.cash ? formatMoney(pay.cash, false) : ''}
                    onChangeText={(text) => pay.setCash(parseAmountInput(text))}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={colors.placeholder}
                    accessibilityLabel={t('verifyRestaurant.cashLabel')}
                    className="h-full flex-1 font-heading text-2xl text-text"
                  />
                  <Text font="bold" tone="muted" className="text-base">
                    {t('common.etb')}
                  </Text>
                </View>
                {cashTooMuch ? (
                  <Text font="semibold" className="px-1 text-[15px] text-dangerFg">
                    {t('verifyRestaurant.cashTooMuch')}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <HeroCard>
              <View accessible>
                <Text font="bold" tone="inverse" className="text-[13px] uppercase opacity-90">
                  {t('verifyRestaurant.customerPaysBank')}
                </Text>
                <Text font="heading" tone="inverse" className="text-[40px] leading-[48px]">
                  {formatMoney(cashTooMuch ? 0 : toScan, false)}{' '}
                  <Text font="heading" tone="inverse" className="text-lg">
                    {t('common.etb')}
                  </Text>
                </Text>
              </View>
              <View className="mt-3 flex-row gap-2">
                <HeroChip style={{ flex: 1 }}>
                  <View
                    accessible
                    accessibilityLabel={t('verifyRestaurant.totalLocked', {
                      amount: formatMoney(bill.total),
                    })}
                  >
                    <View className="flex-row items-center gap-1">
                      <Lock size={13} color="#FFFFFF" strokeWidth={2.4} />
                      <Text tone="inverse" className="text-[13px] opacity-90">
                        {t('verifyRestaurant.totalBill')}
                      </Text>
                    </View>
                    <Text font="heading" tone="inverse" className="text-lg">
                      {formatMoney(bill.total, false)}
                    </Text>
                  </View>
                </HeroChip>
                {cash > 0 ? (
                  <HeroChip style={{ flex: 1 }}>
                    <Text tone="inverse" className="text-[13px] opacity-90">
                      {t('verifyRestaurant.summaryCash')}
                    </Text>
                    <Text font="heading" tone="inverse" className="text-lg">
                      {`− ${formatMoney(cash, false)}`}
                    </Text>
                  </HeroChip>
                ) : null}
                {pay.bankReceived > 0 ? (
                  <HeroChip style={{ flex: 1 }}>
                    <Text tone="inverse" className="text-[13px] opacity-90" numberOfLines={1}>
                      {t('verifyRestaurant.summaryBankAlready')}
                    </Text>
                    <Text font="heading" tone="inverse" className="text-lg">
                      {`− ${formatMoney(pay.bankReceived, false)}`}
                    </Text>
                  </HeroChip>
                ) : null}
              </View>
            </HeroCard>

            {account ? (
              <GlassCard
                onPress={() => setAccountSheet(true)}
                accessibilityLabel={t('verifyRestaurant.chooseAccount')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}
              >
                <BankBadge code={account.bankCode} size={44} />
                <View className="flex-1">
                  <Text className="text-sm" style={{ color: colors.muted }} numberOfLines={1}>
                    {t('verifyRestaurant.moneyGoesTo')}
                  </Text>
                  <Text font="bold" className="text-base" numberOfLines={1}>
                    {account.shortName}{' '}
                    {t(maskedNumberKey(account.bankCode), { last4: account.last4 })}
                  </Text>
                </View>
                <Text font="bold" className="text-[15px]" style={{ color: g.primaryText }}>
                  {t('verifyRestaurant.change')}
                </Text>
              </GlassCard>
            ) : null}

            {__DEV__ ? (
              <View className="gap-1.5 rounded-input border-2 border-dashed border-amber p-2.5">
                <Text font="bold" tone="muted" className="text-sm">
                  {t('verifyRestaurant.devSimulate')}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {simulations.map((s) => (
                    <Pill
                      key={s.value}
                      label={s.label}
                      selected={pay.simulate === s.value}
                      onPress={() => pay.setSimulate(s.value)}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </ScrollView>

          <StickyFooter>
            <PrimaryButton
              label={
                toScan === 0
                  ? t('verifyRestaurant.confirm')
                  : t('verifyRestaurant.checkPayment', { amount: formatMoney(toScan) })
              }
              icon={ShieldCheck}
              disabled={!canGo}
              onPress={proceed}
            />
          </StickyFooter>
        </KeyboardAvoidingView>

        <OptionSheet
          visible={accountSheet}
          title={t('verifyRestaurant.chooseAccount')}
          options={accounts.map((a) => ({
            value: a.id,
            label: `${a.holderName} · ${a.shortName} ${t(maskedNumberKey(a.bankCode), { last4: a.last4 })}`,
            leading: <BankBadge code={a.bankCode} size={40} />,
          }))}
          selected={account?.id ?? ''}
          onSelect={(id) => {
            const next = accounts.find((a) => a.id === id);
            if (next) setAccount(next);
          }}
          onClose={() => setAccountSheet(false)}
        />
      </SafeAreaView>
    </ScreenBackground>
  );
}
