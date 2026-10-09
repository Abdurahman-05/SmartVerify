import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ArrowRight, Fingerprint } from 'lucide-react-native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { LoadingView } from '@/components/ui/LoadingView';
import { Text } from '@/components/ui/Text';
import { signIn } from '@/lib/auth';
import { errorMessageKey } from '@/lib/errors';
import { digitsOnly, formatPhone, PHONE_DIGITS } from '@/lib/format';
import { homeRouteFor, useSession } from '@/store/session';

import { AuthHeader } from './AuthHeader';
import { FormScreen } from '@/components/ui/FormScreen';
import { PinVisibilityButton } from './PinVisibilityButton';
import { PIN_LENGTH, signInSchema, type SignInValues } from './schemas';

export default function SignInScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const startSession = useSession((s) => s.signIn);
  const [showPin, setShowPin] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { phone: '', pin: '', rememberMe: true },
  });

  const mutation = useMutation({
    mutationFn: signIn,
    onSuccess: (user) => {
      startSession(user);
      router.replace(homeRouteFor(user));
    },
  });

  if (mutation.isPending) return <LoadingView />;

  const errorText = (message?: string) =>
    message ? t(message, { count: PIN_LENGTH }) : undefined;

  return (
    <FormScreen>
      <AuthHeader />

      <View className="px-5 pt-6">
        <Text font="heading" className="text-[30px]" accessibilityRole="header">
          {t('auth.welcomeBack')}
        </Text>
        <Text tone="muted" className="mt-1 text-[17px]">
          {t('auth.signInSubtitle')}
        </Text>
      </View>

      <View className="gap-[18px] px-5 pt-6">
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
              label={t('auth.pin')}
              labelRight={
                <Text font="bold" tone="link" className="text-base">
                  {t('auth.forgotPin')}
                </Text>
              }
              placeholder={t('auth.pinPlaceholder')}
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
          name="rememberMe"
          render={({ field }) => (
            <Checkbox
              checked={field.value}
              onChange={field.onChange}
              accessibilityLabel={t('auth.rememberMe')}
            >
              <Text font="semibold" className="text-base">
                {t('auth.rememberMe')}
              </Text>
            </Checkbox>
          )}
        />
      </View>

      <View className="min-h-6 flex-1" />

      <View className="gap-3 px-5">
        {mutation.isError ? (
          <Text font="semibold" className="text-center text-base text-dangerFg">
            {t(errorMessageKey(mutation.error))}
          </Text>
        ) : null}
        <Button
          label={t('auth.signIn')}
          icon={ArrowRight}
          onPress={handleSubmit((values) => mutation.mutate(values))}
        />
        <Text font="bold" tone="muted" className="text-center text-[15px]">
          {t('common.or')}
        </Text>
        <Button
          label={t('auth.signInFingerprint')}
          icon={Fingerprint}
          variant="outline"
          disabled
          onPress={() => {}}
        />
      </View>

      <Pressable
        onPress={() => router.push('/create-account')}
        accessibilityRole="link"
        className="min-h-11 flex-row flex-wrap items-center justify-center pb-7 pt-4"
      >
        <Text className="text-[17px]">{t('auth.noAccount')} </Text>
        <Text font="bold" tone="link" className="text-[17px]">
          {t('auth.signUp')}
        </Text>
      </Pressable>
    </FormScreen>
  );
}
