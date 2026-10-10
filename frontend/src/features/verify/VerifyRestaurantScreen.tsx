import { useQuery } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Landmark, Lock, QrCode, Wallet, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View } from 'react-native';

import { BankBadge } from '@/components/ui/BankBadge';
import { Button } from '@/components/ui/Button';
import { FormScreen } from '@/components/ui/FormScreen';
import { LoadingView } from '@/components/ui/LoadingView';
import { formatMoney, MoneyText } from '@/components/ui/MoneyText';
import { OptionSheet } from '@/components/ui/OptionSheet';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { useBrandColors } from '@/store/theme';
import { useBills } from '@/features/bills/store';
import { Pill } from '@/features/orders/Pill';
import { parseAmountInput } from '@/lib/format';
import { getBankAccounts } from '@/lib/mock/bankAccounts';
import {
  SIMULATED_OVER_ETB,
  SIMULATED_SHORT_ETB,
  type BankCheckSimulation,
} from '@/lib/mock/verify';
import { colors } from '@/theme/tokens';

import { billLabel } from './billLabel';
import { cashFor, settlePayment, useRestaurantPay, type RestaurantMethod } from './restaurantFlow';
import { useVerifyFlow } from './verifyFlow';

const methods: { value: RestaurantMethod; icon: LucideIcon }[] = [
  { value: 'bank', icon: Landmark },
  { value: 'cash+bank', icon: Wallet },
];

function MethodButton({
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
  const brand = useBrandColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={`h-[84px] flex-1 items-center justify-center gap-1.5 rounded-[18px] px-1 ${
        selected ? 'bg-primary' : 'border-2 border-borderStrong bg-surface'
      }`}
    >
      <Icon size={26} color={selected ? colors.surface : brand.primary} strokeWidth={2.2} />
      <Text font="bold" tone={selected ? 'inverse' : 'default'} className="text-center text-base">
        {label}
      </Text>
    </Pressable>
  );
}

function SummaryRow({ label, value, minus }: { label: string; value: number; minus?: boolean }) {
  return (
    <View className="flex-row items-baseline justify-between" accessible>
      <Text font="semibold" tone="inverse" className="text-[17px]">
        {label}
      </Text>
      <Text font="semibold" tone="inverse" className="text-[17px]">
        {minus ? '− ' : ''}
        <MoneyText value={value} font="semibold" tone="inverse" className="text-[17px]" />
      </Text>
    </View>
  );
}

export default function VerifyRestaurantScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { billId } = useLocalSearchParams<{ billId: string }>();
  const bill = useBills((s) => s.bills.find((b) => b.id === billId));
  const pay = useRestaurantPay();
  const { account: chosenAccount, setAccount, setAmount } = useVerifyFlow();
  const [accountSheet, setAccountSheet] = useState(false);
  const { data: accounts } = useQuery({ queryKey: ['bank-accounts'], queryFn: getBankAccounts });

  const { start } = pay;
  useEffect(() => {
    if (billId && pay.billId !== billId) start(billId);
  }, [billId, pay.billId, start]);

  if (!bill) return <Redirect href="/bills" />;
  if (!accounts) return <LoadingView />;

  const account = accounts.find((a) => a.id === chosenAccount?.id) ?? accounts[0];
  const cash = cashFor(pay.method, pay.cash);
  const cashTooMuch = pay.method === 'cash+bank' && cash >= bill.total;
  const toScan = Math.max(bill.total - cash - pay.bankReceived, 0);
  const showSummary = pay.method === 'cash+bank' || pay.bankReceived > 0;
  const canGo = Boolean(account) && !cashTooMuch && bill.status === 'open';

  const proceed = () => {
    if (!account) return;
    setAccount(account);
    if (toScan === 0) {
      settlePayment(bill, 0);
      router.push('/verify-restaurant/result');
      return;
    }
    setAmount(toScan);
    router.push({ pathname: '/scan', params: { mode: 'restaurant' } });
  };

  const simulations: { value: BankCheckSimulation; label: string }[] = [
    { value: 'exact', label: t('verifyRestaurant.devExact') },
    { value: 'over', label: t('verifyRestaurant.devOver', { amount: SIMULATED_OVER_ETB }) },
    { value: 'short', label: t('verifyRestaurant.devShort', { amount: SIMULATED_SHORT_ETB }) },
  ];

  return (
    <FormScreen>
      <ScreenHeader
        title={t('verifyRestaurant.title')}
        subtitle={billLabel(t, bill)}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/bills'))}
      />

      <View className="gap-[18px] px-4 pt-2">
        <View className="gap-2">
          <Text font="bold" className="text-[17px]">
            {t('verifyRestaurant.howPaying')}
          </Text>
          <View className="flex-row gap-2" accessibilityRole="radiogroup">
            {methods.map(({ value, icon }) => (
              <MethodButton
                key={value}
                label={t(`verifyRestaurant.method.${value}`)}
                icon={icon}
                selected={pay.method === value}
                onPress={() => pay.setMethod(value)}
              />
            ))}
          </View>
        </View>

        <View className="gap-1.5">
          <Text font="bold" className="text-[17px]">
            {t('verifyRestaurant.totalBill')}
          </Text>
          <View
            accessible
            accessibilityLabel={t('verifyRestaurant.totalLocked', {
              amount: formatMoney(bill.total),
            })}
            className="h-16 flex-row items-center gap-3 rounded-input border-2 border-borderStrong bg-neutralBg px-[18px]"
          >
            <Text font="bold" tone="muted" className="text-[17px]">
              {t('common.etb')}
            </Text>
            <MoneyText
              value={bill.total}
              showCurrency={false}
              className="flex-1 text-right text-[28px]"
            />
            <Lock size={22} color={colors.muted} strokeWidth={2.2} />
          </View>
        </View>

        {pay.method === 'cash+bank' ? (
          <View className="gap-1.5">
            <Text font="bold" className="text-[17px]">
              {t('verifyRestaurant.cashGave')}
            </Text>
            <View
              className={`h-16 flex-row items-center gap-3 rounded-input border-2 bg-surface px-[18px] ${
                cashTooMuch ? 'border-dangerFg' : 'border-borderStrong'
              }`}
            >
              <Text font="bold" tone="muted" className="text-[17px]">
                {t('common.etb')}
              </Text>
              <TextInput
                value={pay.cash ? formatMoney(pay.cash, false) : ''}
                onChangeText={(text) => pay.setCash(parseAmountInput(text))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.placeholder}
                accessibilityLabel={t('verifyRestaurant.cashLabel')}
                className="h-full flex-1 text-right font-heading text-[28px] text-text"
              />
            </View>
            {cashTooMuch ? (
              <Text font="semibold" className="text-[15px] text-dangerFg">
                {t('verifyRestaurant.cashTooMuch')}
              </Text>
            ) : null}
          </View>
        ) : null}

        {showSummary && !cashTooMuch ? (
          <View className="gap-1 rounded-[20px] bg-primary px-[18px] py-3.5">
            <SummaryRow label={t('verifyRestaurant.summaryTotal')} value={bill.total} />
            {cash > 0 ? (
              <SummaryRow label={t('verifyRestaurant.summaryCash')} value={cash} minus />
            ) : null}
            {pay.bankReceived > 0 ? (
              <SummaryRow
                label={t('verifyRestaurant.summaryBankAlready')}
                value={pay.bankReceived}
                minus
              />
            ) : null}
            <View className="mt-1.5 border-t-2 border-white/35 pt-2" accessible>
              <Text font="semibold" tone="inverse" className="text-base">
                {t('verifyRestaurant.mustPayBank')}
              </Text>
              <MoneyText
                value={toScan}
                tone="inverse"
                className="text-4xl"
                numberOfLines={1}
                adjustsFontSizeToFit
              />
            </View>
          </View>
        ) : null}

        {account ? (
          <View className="flex-row items-center gap-2.5 rounded-input border-[1.5px] border-border bg-surface px-3 py-2">
            <BankBadge code={account.bankCode} size={40} />
            <View className="flex-1">
              <Text font="bold" className="text-base" numberOfLines={1}>
                {account.bankName}
              </Text>
              <Text tone="muted" className="text-sm">
                {t('verifyRestaurant.receivingAccount', { last4: account.last4 })}
              </Text>
            </View>
            <Pressable
              onPress={() => setAccountSheet(true)}
              accessibilityRole="button"
              accessibilityLabel={t('verifyRestaurant.chooseAccount')}
              className="h-11 justify-center rounded-[22px] border-2 border-borderStrong bg-surface px-3.5 active:bg-background"
            >
              <Text font="bold" tone="link" className="text-[15px]">
                {t('verifyRestaurant.change')}
              </Text>
            </Pressable>
          </View>
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
      </View>

      <View className="min-h-6 flex-1" />

      <View className="px-4 pb-6 pt-2">
        <Button
          label={
            toScan === 0
              ? t('verifyRestaurant.confirm')
              : t('verifyRestaurant.scanQr', { amount: formatMoney(toScan) })
          }
          icon={QrCode}
          disabled={!canGo}
          onPress={proceed}
        />
      </View>

      <OptionSheet
        visible={accountSheet}
        title={t('verifyRestaurant.chooseAccount')}
        options={accounts.map((a) => ({
          value: a.id,
          label: a.bankName,
          leading: <BankBadge code={a.bankCode} size={40} />,
        }))}
        selected={account?.id ?? ''}
        onSelect={(id) => {
          const next = accounts.find((a) => a.id === id);
          if (next) setAccount(next);
        }}
        onClose={() => setAccountSheet(false)}
      />
    </FormScreen>
  );
}
