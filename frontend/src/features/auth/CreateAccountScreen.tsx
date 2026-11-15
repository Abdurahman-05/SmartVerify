import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ChevronLeft, Store, User } from 'lucide-react-native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Keyboard, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AuthBackground } from '@/components/ui/AuthBackground';
import { Checkbox } from '@/components/ui/Checkbox';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { Input } from '@/components/ui/Input';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { LoadingView } from '@/components/ui/LoadingView';
import { Text } from '@/components/ui/Text';
import { useFullFieldFeedback } from '@/hooks/useFullFieldFeedback';
import { createAccount } from '@/lib/auth';
import { errorMessageKey } from '@/lib/errors';
import { digitsOnly, formatPhone, PHONE_DIGITS } from '@/lib/format';
import { homeRouteFor, useSession } from '@/store/session';

import { FormScreen } from '@/components/ui/FormScreen';
import {
  AUTH,
  AuthCard,
  AuthFooter,
  AuthLogo,
  AuthSubtitle,
  AuthTitle,
  PhoneFilled,
  ShieldFilled,
} from './AuthParts';
import { PinVisibilityButton } from './PinVisibilityButton';
import { createAccountSchema, PIN_LENGTH, type CreateAccountValues } from './schemas';
import { colors } from '@/theme/tokens';
import { GlassCard, PrimaryButton } from '@/ui/glass';

export default function CreateAccountScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const startSession = useSession((s) => s.signIn);
  const [showPin, setShowPin] = useState(false);
  const phoneFull = useFullFieldFeedback(PHONE_DIGITS);

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
      // New owner: passcode first, then Choose plan (no plan yet).
      router.replace(homeRouteFor(user));
    },
  });

  if (mutation.isPending) return <LoadingView />;

  const errorText = (message?: string) => (message ? t(message, { count: PIN_LENGTH }) : undefined);

  const goToSignIn = () => (router.canGoBack() ? router.back() : router.replace('/sign-in'));

  return (
    <AuthBackground>
      <FormScreen plain>
        <View className="absolute left-5 right-5 top-4 z-10 flex-row items-center justify-between">
          <GlassCard
            radius={22}
            onPress={goToSignIn}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            className="h-11 w-11 items-center justify-center"
          >
            <ChevronLeft size={22} color={colors.text} strokeWidth={2.2} />
          </GlassCard>
          <LanguageToggle />
        </View>
        {/* Design: same look as Sign in (assets/images/auth/reference-signin.png). */}
        <View
          className="flex-1 items-center pb-6"
          style={{ paddingTop: 56, paddingHorizontal: 22 }}
        >
          <AuthLogo />
          <AuthTitle text={t('auth.createAccount')} />
          <AuthSubtitle text={t('auth.step', { current: 1, total: 2 })} />
          <View className="mt-2.5 w-28 flex-row gap-1.5">
            <View className="h-1.5 flex-1 rounded-[3px]" style={{ backgroundColor: AUTH.p }} />
            <View className="h-1.5 flex-1 rounded-[3px] bg-black/10" />
          </View>

          <AuthCard>
            <Controller
              control={control}
              name="fullName"
              render={({ field }) => (
                <Input
                  label={t('auth.fullName')}
                  labelIcon={User}
                  labelIconColor={AUTH.p}
                  round
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
                  labelIcon={Store}
                  labelIconColor={AUTH.p}
                  round
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
                <Animated.View style={phoneFull.style}>
                  <Input
                    label={t('auth.phone')}
                    labelIcon={PhoneFilled}
                    labelIconColor={AUTH.p}
                    round
                    prefix="+251"
                    placeholder={t('auth.phonePlaceholder')}
                    value={formatPhone(field.value)}
                    onChangeText={(text) => field.onChange(phoneFull.limit(text, field.value))}
                    onBlur={field.onBlur}
                    keyboardType="number-pad"
                    textContentType="telephoneNumber"
                    autoComplete="tel"
                    // "912 345 678" is 11 characters; one more lets an extra digit reach `limit`.
                    maxLength={12}
                    error={errorText(errors.phone?.message)}
                  />
                </Animated.View>
              )}
            />

            <Controller
              control={control}
              name="pin"
              render={({ field }) => (
                <Input
                  label={t('auth.newPin', { count: PIN_LENGTH })}
                  labelIcon={ShieldFilled}
                  labelIconColor={AUTH.p}
                  round
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
                    <Text className="text-[15px]">
                      {t('auth.agreePrefix')}
                      <Text font="bold" className="text-[15px]" style={{ color: AUTH.pt }}>
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
            <PrimaryButton
              accent
              label={t('auth.continue')}
              onPress={() => {
                Keyboard.dismiss();
                void handleSubmit(({ acceptTerms: _accepted, ...values }) =>
                  mutation.mutate(values)
                )();
              }}
            />
          </AuthCard>

          <AuthFooter
            prefix={t('auth.haveAccount')}
            link={t('auth.signIn')}
            onPress={goToSignIn}
            secure={t('brand.secure')}
          />
        </View>

        <ErrorDialog
          visible={mutation.isError}
          title={t('auth.errors.createFailedTitle')}
          message={t(errorMessageKey(mutation.error))}
          actionLabel={t('errors.retry')}
          onClose={mutation.reset}
        />
      </FormScreen>
    </AuthBackground>
  );
}
