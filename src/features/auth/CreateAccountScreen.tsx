import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { LoadingView } from '@/components/ui/LoadingView';
import { Text } from '@/components/ui/Text';
import { createAccount } from '@/lib/mock/auth';
import { digitsOnly, formatPhone, PHONE_DIGITS } from '@/lib/format';
import { useSession } from '@/store/session';

import { AuthHeader } from './AuthHeader';
import { FormScreen } from '@/components/ui/FormScreen';
import { PinVisibilityButton } from './PinVisibilityButton';
import { createAccountSchema, PIN_LENGTH, type CreateAccountValues } from './schemas';

export default function CreateAccountScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const startSession = useSession((s) => s.signIn);
  const [showPin, setShowPin] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateAccountValues>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: { fullName: '', businessName: '', phone: '', pin: '', acceptTerms: false },
  });

  const mutation = useMutation({
    mutationFn: createAccount,
    onSuccess: (user) => {
      startSession(user);
      router.replace('/choose-plan');
    },
  });

  if (mutation.isPending) return <LoadingView />;

  const errorText = (message?: string) =>
    message ? t(message, { count: PIN_LENGTH }) : undefined;

  const goToSignIn = () => (router.canGoBack() ? router.back() : router.replace('/sign-in'));

  return (
    <FormScreen>
      <AuthHeader onBack={goToSignIn} />

      <View className="px-5 pt-3">
        <View className="flex-row gap-1.5">
          <View className="h-2 flex-1 rounded bg-primary" />
          <View className="h-2 flex-1 rounded bg-borderMid" />
        </View>
        <Text font="bold" tone="muted" className="mt-2 text-[15px]">
          {t('auth.step', { current: 1, total: 2 })}
        </Text>
      </View>

      <View className="px-5 pt-2.5">
        <Text font="heading" className="text-[30px]" accessibilityRole="header">
          {t('auth.createAccount')}
        </Text>
      </View>

      <View className="gap-3.5 px-5 pt-[18px]">
        <Controller
          control={control}
          name="fullName"
          render={({ field }) => (
            <Input
              label={t('auth.fullName')}
              placeholder={t('auth.fullNamePlaceholder')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              autoCapitalize="words"
              textContentType="name"
              autoComplete="name"
              error={errorText(errors.fullName?.message)}
            />
          )}
        />

        <Controller
          control={control}
          name="businessName"
          render={({ field }) => (
            <Input
              label={t('auth.businessName')}
              placeholder={t('auth.businessNamePlaceholder')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              autoCapitalize="words"
              textContentType="organizationName"
              error={errorText(errors.businessName?.message)}
            />
          )}
        />

        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <Input
              label={t('auth.phone')}
              prefix="+251"
              placeholder={t('auth.phonePlaceholder')}
              value={formatPhone(field.value)}
              onChangeText={(text) => field.onChange(digitsOnly(text, PHONE_DIGITS))}
              onBlur={field.onBlur}
              keyboardType="number-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              maxLength={11}
              error={errorText(errors.phone?.message)}
            />
          )}
        />

        <Controller
          control={control}
          name="pin"
          render={({ field }) => (
            <Input
              label={t('auth.newPin', { count: PIN_LENGTH })}
              placeholder={t('auth.newPinPlaceholder', { count: PIN_LENGTH })}
              value={field.value}
              onChangeText={(text) => field.onChange(digitsOnly(text, PIN_LENGTH))}
              onBlur={field.onBlur}
              keyboardType="number-pad"
              secureTextEntry={!showPin}
              maxLength={PIN_LENGTH}
              rightAccessory={
                <PinVisibilityButton visible={showPin} onToggle={() => setShowPin((v) => !v)} />
              }
              error={errorText(errors.pin?.message)}
            />
          )}
        />

        <Controller
          control={control}
          name="acceptTerms"
          render={({ field }) => (
            <View className="gap-1">
              <Checkbox
                checked={field.value}
                onChange={field.onChange}
                accessibilityLabel={`${t('auth.agreePrefix')}${t('auth.agreeLink')}${t('auth.agreeSuffix')}`}
              >
                <Text font="semibold" className="text-base">
                  {t('auth.agreePrefix')}
                  <Text font="bold" tone="link" className="text-base">
                    {t('auth.agreeLink')}
                  </Text>
                  {t('auth.agreeSuffix')}
                </Text>
              </Checkbox>
              {errors.acceptTerms ? (
                <Text font="semibold" className="text-[15px] text-dangerFg">
                  {t('auth.errors.terms')}
                </Text>
              ) : null}
            </View>
          )}
        />
      </View>

      <View className="min-h-6 flex-1" />

      <View className="gap-3 px-5">
        {mutation.isError ? (
          <Text font="semibold" className="text-center text-base text-dangerFg">
            {t('common.somethingWrong')}
          </Text>
        ) : null}
        <Button
          label={t('auth.createAccount')}
          icon={ArrowRight}
          onPress={handleSubmit(({ acceptTerms: _accepted, ...values }) => mutation.mutate(values))}
        />
      </View>

      <Pressable
        onPress={goToSignIn}
        accessibilityRole="link"
        className="min-h-11 flex-row flex-wrap items-center justify-center pb-7 pt-4"
      >
        <Text className="text-[17px]">{t('auth.haveAccount')} </Text>
        <Text font="bold" tone="link" className="text-[17px]">
          {t('auth.signIn')}
        </Text>
      </Pressable>
    </FormScreen>
  );
}
