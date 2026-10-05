import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Plus, QrCode } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { FormScreen } from '@/components/ui/FormScreen';
import { LoadingView } from '@/components/ui/LoadingView';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { getBankAccounts } from '@/lib/api/bankAccounts';
import { formatAmount, formatAmountInput, parseAmount, sanitizeAmountInput } from '@/lib/format';
import { colors } from '@/theme/tokens';

import { AccountPicker } from './AccountPicker';
import { useVerifyFlow } from './verifyFlow';

export default function VerifyPaymentScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [amountFocused, setAmountFocused] = useState(false);
  const { account: chosenAccount, amountInput, setAccount, setAmountInput } = useVerifyFlow();
  const { data: accounts, isPending } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: getBankAccounts,
  });

  if (isPending || !accounts) return <LoadingView />;

  const account = accounts.find((a) => a.id === chosenAccount?.id) ?? accounts[0];
  const amount = parseAmount(amountInput);
  const canScan = Boolean(account) && amount > 0;

  const startScan = () => {
    if (!account) return;
    setAccount(account);
    router.push('/scan');
  };

  return (
    <FormScreen edges={['top']}>
      <ScreenHeader title={t('verify.title')} onBack={() => router.navigate('/home')} />

      <View className="gap-5 px-4 pt-3">
        <View className="gap-2">
          <Text font="bold" className="text-[17px]">
            {t('verify.whereSent')}
          </Text>
          {account ? (
            <AccountPicker
              accounts={accounts}
              selected={account}
              onSelect={setAccount}
              onAddAccount={() => router.push('/add-bank-account')}
            />
          ) : (
            <View className="gap-3 rounded-[18px] border-2 border-dashed border-borderStrong bg-surface p-4">
              <Text tone="muted" className="text-base">
                {t('bankAccounts.noAccountsVerify')}
              </Text>
              <Button
                label={t('bankAccounts.addAccount')}
                icon={Plus}
                size="md"
                onPress={() => router.push('/add-bank-account')}
              />
            </View>
          )}
        </View>

        <View className="gap-2">
          <Text font="bold" className="text-[17px]">
            {t('verify.howMuch')}
          </Text>
          <View
            className={`h-[76px] flex-row items-center gap-3 rounded-[18px] border-2 bg-surface px-[18px] ${
              amountFocused ? 'border-primary' : 'border-borderStrong'
            }`}
          >
            <Text font="bold" tone="muted" className="text-lg">
              {t('common.etb')}
            </Text>
            <TextInput
              value={formatAmountInput(amountInput)}
              onChangeText={(text) => setAmountInput(sanitizeAmountInput(text))}
              onFocus={() => setAmountFocused(true)}
              onBlur={() => setAmountFocused(false)}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.placeholder}
              accessibilityLabel={t('verify.amountLabel')}
              className="h-full flex-1 text-right font-heading text-[34px] text-text"
            />
          </View>
        </View>
      </View>

      <View className="mx-4 mt-5 rounded-card bg-primary px-5 py-4">
        <Text font="semibold" tone="inverse" className="text-base">
          {t('verify.totalLabel')}
        </Text>
        <Text font="heading" tone="inverse" className="mt-0.5 text-[38px]" numberOfLines={1} adjustsFontSizeToFit>
          {formatAmount(amount)} {t('common.etb')}
        </Text>
      </View>

      <View className="min-h-6 flex-1" />

      <View className="gap-2.5 px-4 pb-7">
        <Text font="semibold" tone="muted" className="text-center text-base">
          {t('verify.askQr')}
        </Text>
        <Pressable
          onPress={startScan}
          disabled={!canScan}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canScan }}
          className={`h-[68px] flex-row items-center justify-center gap-2.5 rounded-[20px] bg-primary ${
            canScan ? 'active:opacity-80' : 'opacity-50'
          }`}
        >
          <QrCode size={26} color={colors.surface} strokeWidth={2.2} />
          <Text font="bold" tone="inverse" className="text-[21px]">
            {t('verify.scanQr')}
          </Text>
        </Pressable>
      </View>
    </FormScreen>
  );
}
