import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ChevronLeft, Store, User } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { BackHandler, Keyboard, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AuthBackground } from '@/components/ui/AuthBackground';
import { Checkbox } from '@/components/ui/Checkbox';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { FormScreen } from '@/components/ui/FormScreen';
import { Input } from '@/components/ui/Input';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { LoadingView } from '@/components/ui/LoadingView';
import { Text } from '@/components/ui/Text';
import { useFullFieldFeedback } from '@/hooks/useFullFieldFeedback';
import { createShopAccount } from '@/lib/auth';
import { errorMessageKey } from '@/lib/errors';
import { digitsOnly, formatPhone, localPhoneDigits, PHONE_DIGITS } from '@/lib/format';
import { openLegal } from '@/lib/legal';
import { useSession } from '@/store/session';
import { colors } from '@/theme/tokens';
import { GlassCard, PrimaryButton } from '@/ui/glass';

import {
  AuthCard,
  AuthFooter,
  AuthLogo,
  AuthSubtitle,
  AuthTitle,
  PhoneFilled,
  ShieldFilled,
  useAuthColors,
} from './AuthParts';
import { PinVisibilityButton } from './PinVisibilityButton';
import { createShopAccountSchema, SHOP_PIN_LENGTH, type CreateShopAccountValues } from './schemas';

/**
 * Shop app Create account: no email, no code. Step 1 = your name, shop name and phone number;
 * step 2 = a 4-digit PIN and the terms. Then the same first-run pages as every new owner.
 */
export default function ShopCreateAccountScreen() {
  const auth = useAuthColors();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const startSession = useSession((s) => s.signIn);
  const [showPin, setShowPin] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const phoneFull = useFullFieldFeedback(PHONE_DIGITS);

  const {
    control,
    handleSubmit,
    trigger,
    formState: { errors },
  } = useForm<CreateShopAccountValues>({
    resolver: zodResolver(createShopAccountSchema),
    defaultValues: { fullName: '', businessName: '', phone: '', pin: '', acceptTerms: false },
  });

  // Android back button on step 2 returns to step 1 instead of leaving.
  useEffect(() => {
    if (step !== 2) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setStep(1);
      return true;
    });
    return () => sub.remove();
  }, [step]);

  const mutation = useMutation({
    mutationFn: ({ acceptTerms: _accepted, ...values }: CreateShopAccountValues) =>
      createShopAccount(values),
    onSuccess: (user) => {
      startSession(user);
      router.replace({ pathname: '/business-location', params: { onboarding: '1' } });
    },
  });

  if (mutation.isPending) return <LoadingView />;

  const errorText = (message?: string) =>
    message ? t(message, { count: SHOP_PIN_LENGTH }) : undefined;
  const goToSignIn = () => (router.canGoBack() ? router.back() : router.replace('/sign-in'));
  const goBack = () => (step === 2 ? setStep(1) : goToSignIn());

  return (
    <AuthBackground>
      <FormScreen plain>
        <View className="absolute left-5 right-5 top-4 z-10 flex-row items-center justify-between">
          <GlassCard
            radius={24}
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            className="h-12 w-12 items-center justify-center"
          >
            <ChevronLeft size={24} color={colors.text} strokeWidth={2.2} />
          </GlassCard>
          <LanguageToggle />
        </View>
        <View
          className="flex-1 items-center pb-6"
          style={{ paddingTop: 56, paddingHorizontal: 22 }}
        >
          <AuthLogo />
          <AuthTitle text={t('auth.createAccount')} />
          {/* 3 steps in all: these two, then Choose plan. */}
          <AuthSubtitle text={t('auth.step', { current: step, total: 3 })} />
          <View className="mt-2.5 w-32 flex-row gap-1.5">
            {[1, 2, 3].map((n) => (
              <View
                key={n}
                className={`h-1.5 flex-1 rounded-[3px] ${n <= step ? '' : 'bg-black/10'}`}
                style={n <= step ? { backgroundColor: auth.p } : null}
              />
            ))}
          </View>

          <AuthCard>
            {step === 1 ? (
              <>
                <Controller
                  control={control}
                  name="fullName"
                  render={({ field }) => (
                    <Input
                      label={t('auth.fullName')}
                      labelIcon={User}
                      labelIconColor={auth.p}
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
                      label={t('auth.shopName')}
                      labelIcon={Store}
                      labelIconColor={auth.p}
                      round
                      placeholder={t('auth.shopNamePlaceholder')}
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
                        labelIconColor={auth.p}
                        round
                        prefix="+251"
                        placeholder={t('auth.phonePlaceholder')}
                        // 0912345678, +251912345678 and 912345678 all become 912345678.
                        value={formatPhone(field.value)}
                        onChangeText={(text) =>
                          field.onChange(phoneFull.limit(localPhoneDigits(text), field.value))
                        }
                        onBlur={field.onBlur}
                        keyboardType="number-pad"
                        textContentType="telephoneNumber"
                        autoComplete="tel"
                        maxLength={16}
                        error={errorText(errors.phone?.message)}
                      />
                      <Text className="mt-1 px-1 text-[14px]" style={{ color: colors.muted }}>
                        {t('auth.phoneHint')}
                      </Text>
                    </Animated.View>
                  )}
                />
              </>
            ) : (
              <>
                <Text className="text-[15px] leading-6" style={{ color: colors.muted }}>
                  {t('auth.pinHint')}
                </Text>
                <Controller
                  control={control}
                  name="pin"
                  render={({ field }) => (
                    <Input
                      label={t('auth.newPin', { count: SHOP_PIN_LENGTH })}
                      labelIcon={ShieldFilled}
                      labelIconColor={auth.p}
                      round
                      placeholder={t('auth.newPinPlaceholder', { count: SHOP_PIN_LENGTH })}
                      value={field.value}
                      onChangeText={(text) => field.onChange(digitsOnly(text, SHOP_PIN_LENGTH))}
                      onBlur={field.onBlur}
                      keyboardType="number-pad"
                      secureTextEntry={!showPin}
                      maxLength={SHOP_PIN_LENGTH}
                      rightAccessory={
                        <PinVisibilityButton
                          visible={showPin}
                          onToggle={() => setShowPin((v) => !v)}
                        />
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
                        accessibilityLabel={`${t('auth.agreePrefix')}${t('auth.agreeTerms')}${t('auth.agreeAnd')}${t('auth.agreePrivacy')}${t('auth.agreeSuffix')}`}
                      >
                        <Text className="text-[15px]">
                          {t('auth.agreePrefix')}
                          <Text
                            font="bold"
                            className="text-[15px]"
                            style={{ color: auth.pt }}
                            accessibilityRole="link"
                            onPress={() => openLegal('terms', i18n.language)}
                          >
                            {t('auth.agreeTerms')}
                          </Text>
                          {t('auth.agreeAnd')}
                          <Text
                            font="bold"
                            className="text-[15px]"
                            style={{ color: auth.pt }}
                            accessibilityRole="link"
                            onPress={() => openLegal('privacy', i18n.language)}
                          >
                            {t('auth.agreePrivacy')}
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
              </>
            )}

            <PrimaryButton
              accent
              label={step === 1 ? t('auth.continue') : t('auth.createAccount')}
              onPress={() => {
                Keyboard.dismiss();
                if (step === 1) {
                  void trigger(['fullName', 'businessName', 'phone']).then(
                    (ok) => ok && setStep(2)
                  );
                  return;
                }
                void handleSubmit((values) => mutation.mutate(values))();
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
