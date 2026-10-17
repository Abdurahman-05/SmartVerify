import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ChevronDown, Info, Link } from 'lucide-react-native';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { z } from 'zod';

import { BankBadge } from '@/components/ui/BankBadge';
import { Button } from '@/components/ui/Button';
import { FormScreen } from '@/components/ui/FormScreen';
import { Input } from '@/components/ui/Input';
import { LoadingView } from '@/components/ui/LoadingView';
import { OptionSheet } from '@/components/ui/OptionSheet';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { useBrandColors } from '@/store/theme';
import { addBankAccount, BankAccountError, banks } from '@/lib/bankAccounts';
import { errorMessageKey } from '@/lib/errors';
import { digitsOnly } from '@/lib/format';
import { colors } from '@/theme/tokens';

import { TELEBIRR, TELEBIRR_PHONE } from './telebirr';

/** CBE accounts need the holder name: CBE receipts show it and the check compares it. */
const CBE = 'CBE';
/** Banks whose receipts show the receiver's name, which payment checks compare. */
const NAME_CHECKED = [CBE, TELEBIRR, 'DAS', 'BOA'];

const schema = z
  .object({
    bankCode: z.string(),
    accountNumber: z.string(),
    holderName: z.string().trim().max(80),
  })
  .superRefine(({ bankCode, accountNumber, holderName }, ctx) => {
    const telebirr = bankCode === TELEBIRR;
    if (!(telebirr ? TELEBIRR_PHONE : /^\d{8,16}$/).test(accountNumber)) {
      ctx.addIssue({
        code: 'custom',
        path: ['accountNumber'],
        message: telebirr
          ? 'bankAccounts.errors.telebirrPhone'
          : 'bankAccounts.errors.accountNumber',
      });
    }
    // CBE receipts show the receiver's name; payment checks compare it with this name.
    if (NAME_CHECKED.includes(bankCode) && !holderName) {
      ctx.addIssue({
        code: 'custom',
        path: ['holderName'],
        message: 'bankAccounts.errors.holderRequired',
      });
    }
  });

type Values = z.infer<typeof schema>;

function Note({ children }: { children: string }) {
  const brand = useBrandColors();
  return (
    <View className="flex-row items-start gap-2">
      <Info size={18} color={brand.primaryText} strokeWidth={2.2} />
      <Text tone="muted" className="flex-1 text-sm leading-5">
        {children}
      </Text>
    </View>
  );
}

function FieldHint({ children }: { children: string }) {
  return (
    <Text font="semibold" tone="muted" className="text-sm">
      {children}
    </Text>
  );
}

export default function AddBankAccountScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [bankSheetOpen, setBankSheetOpen] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    setValue,
    clearErrors,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { bankCode: banks[0].code, accountNumber: '', holderName: '' },
  });

  const bankCode = useWatch({ control, name: 'bankCode' });

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/bank-accounts'));

  const mutation = useMutation({
    mutationFn: addBankAccount,
    onSuccess: () => {
      queryClient.invalidateQueries();
      goBack();
    },
    onError: (error) => {
      if (error instanceof BankAccountError && error.code === 'duplicate') {
        setError('accountNumber', { message: 'bankAccounts.errors.duplicate' });
      }
    },
  });

  if (mutation.isPending) {
    return (
      <LoadingView
        title={t('bankAccounts.connecting')}
        subtitle={t('bankAccounts.connectingSubtitle')}
      />
    );
  }

  const bank = banks.find((b) => b.code === bankCode) ?? banks[0];
  const telebirr = bank.code === TELEBIRR;
  // CBE and telebirr receipts show the receiver's name; payment checks compare it.
  const nameNeeded = NAME_CHECKED.includes(bank.code);
  const generalError =
    mutation.error &&
    !(mutation.error instanceof BankAccountError && mutation.error.code === 'duplicate')
      ? mutation.error instanceof BankAccountError
        ? t('bankAccounts.errors.limit')
        : t(errorMessageKey(mutation.error))
      : null;

  return (
    <FormScreen>
      <ScreenHeader
        title={t('bankAccounts.add_title')}
        subtitle={t('bankAccounts.add_subtitle')}
        onBack={goBack}
      />

      <View className="gap-5 px-4 pt-3">
        <View className="gap-2">
          <View className="flex-row items-baseline justify-between">
            <Text font="bold" className="text-[17px]">
              {t('bankAccounts.bank')}
            </Text>
            <FieldHint>{t('bankAccounts.country')}</FieldHint>
          </View>
          <Pressable
            onPress={() => setBankSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`${t('bankAccounts.bank')}: ${bank.name}. ${t('bankAccounts.chooseBank')}`}
            className="h-[60px] flex-row items-center gap-3 rounded-input border-2 border-primary bg-surface pl-2.5 pr-3.5 active:bg-background"
          >
            <BankBadge code={bank.code} size={40} />
            <Text font="bold" className="flex-1 text-[17px]" numberOfLines={1}>
              {bank.name}
            </Text>
            <ChevronDown size={24} color={colors.text} strokeWidth={2} />
          </Pressable>
          <Note>{t(telebirr ? 'bankAccounts.telebirrNote' : 'bankAccounts.bankNote')}</Note>
        </View>

        <Controller
          control={control}
          name="accountNumber"
          render={({ field }) => (
            <Input
              label={t(telebirr ? 'bankAccounts.telebirrPhone' : 'bankAccounts.accountNumber')}
              labelRight={
                <FieldHint>
                  {t(
                    telebirr ? 'bankAccounts.telebirrPhoneHint' : 'bankAccounts.accountNumberHint'
                  )}
                </FieldHint>
              }
              placeholder={t(
                telebirr
                  ? 'bankAccounts.telebirrPhonePlaceholder'
                  : 'bankAccounts.accountNumberPlaceholder'
              )}
              value={field.value}
              onChangeText={(text) => field.onChange(digitsOnly(text, telebirr ? 10 : 16))}
              onBlur={field.onBlur}
              keyboardType={telebirr ? 'phone-pad' : 'number-pad'}
              textContentType={telebirr ? 'telephoneNumber' : 'none'}
              maxLength={telebirr ? 10 : 16}
              style={{ letterSpacing: 0.7 }}
              error={errors.accountNumber?.message ? t(errors.accountNumber.message) : undefined}
            />
          )}
        />

        <View className="gap-2">
          <Controller
            control={control}
            name="holderName"
            render={({ field }) => (
              <Input
                label={t('bankAccounts.holderName')}
                labelRight={
                  <FieldHint>
                    {t(nameNeeded ? 'bankAccounts.required' : 'bankAccounts.optional')}
                  </FieldHint>
                }
                placeholder={t('bankAccounts.holderPlaceholder')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                autoCapitalize="words"
                textContentType="name"
                error={errors.holderName?.message ? t(errors.holderName.message) : undefined}
              />
            )}
          />
          <Note>{t(nameNeeded ? 'bankAccounts.holderNoteCbe' : 'bankAccounts.holderNote')}</Note>
        </View>
      </View>

      <View className="min-h-6 flex-1" />

      <View className="gap-2.5 px-4 pb-7">
        {generalError ? (
          <Text font="semibold" className="text-center text-base text-dangerFg">
            {generalError}
          </Text>
        ) : null}
        <Button
          label={t('bankAccounts.connect')}
          icon={Link}
          onPress={handleSubmit((values) =>
            mutation.mutate({
              bankCode: values.bankCode,
              accountNumber: values.accountNumber,
              holderName: values.holderName || undefined,
            })
          )}
        />
        <Button label={t('bankAccounts.cancel')} variant="outline" size="md" onPress={goBack} />
      </View>

      <OptionSheet
        visible={bankSheetOpen}
        title={t('bankAccounts.chooseBank')}
        options={banks.map((b) => ({
          value: b.code,
          label: b.name,
          leading: <BankBadge code={b.code} size={40} />,
        }))}
        selected={bank.code}
        onSelect={(code) => {
          // A phone number and an account number are different things: start the field again.
          if ((code === TELEBIRR) !== telebirr) setValue('accountNumber', '');
          setValue('bankCode', code);
          clearErrors(['accountNumber', 'holderName']);
        }}
        onClose={() => setBankSheetOpen(false)}
      />
    </FormScreen>
  );
}
