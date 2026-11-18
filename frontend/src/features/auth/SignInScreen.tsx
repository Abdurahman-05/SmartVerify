import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Mail } from 'lucide-react-native';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Keyboard, Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AuthBackground } from '@/components/ui/AuthBackground';
import { Checkbox } from '@/components/ui/Checkbox';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { FormScreen } from '@/components/ui/FormScreen';
import { Input } from '@/components/ui/Input';
import { Segmented } from '@/components/ui/Segmented';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { LoadingView } from '@/components/ui/LoadingView';
import { Text } from '@/components/ui/Text';
import { useFullFieldFeedback } from '@/hooks/useFullFieldFeedback';
import { signIn, signOut } from '@/lib/auth';
import { errorMessageKey } from '@/lib/errors';
import { digitsOnly, formatPhone, PHONE_DIGITS } from '@/lib/format';
import { belongsToOtherApp, isNormalApp } from '@/lib/variant';
import { signInWithEmail } from '@/services/authService';
import { homeRouteFor, useSession } from '@/store/session';
import { colors } from '@/theme/tokens';
import { PrimaryButton } from '@/ui/glass';

import {
  AUTH,
  useAuthColors,
  AuthCard,
  AuthFooter,
  AuthLogo,
  AuthSubtitle,
  AuthTitle,
  PhoneFilled,
  ShieldFilled,
} from './AuthParts';
import { PinVisibilityButton } from './PinVisibilityButton';
import { PIN_LENGTH, signInFormSchema, type SignInFormValues } from './schemas';

/** The account belongs to the other app (shop plan in the Restaurant app, or the reverse). */
class WrongAppError extends Error {}

export default function SignInScreen() {
  const auth = useAuthColors();
  const { t } = useTranslation();
  const router = useRouter();
  const { notice } = useLocalSearchParams<{ notice?: string }>();
  const startSession = useSession((s) => s.signIn);
  const [showPin, setShowPin] = useState(false);
  const phoneFull = useFullFieldFeedback(PHONE_DIGITS);

  const {
    control,
    handleSubmit,
    setValue,
    clearErrors,
    formState: { errors },
  } = useForm<SignInFormValues>({
    resolver: zodResolver(signInFormSchema),
    defaultValues: { mode: 'owner', email: '', phone: '', pin: '', rememberMe: true },
  });
  const mode = useWatch({ control, name: 'mode' });

  const mutation = useMutation({
    // A business of the other app is not signed in here at all.
    mutationFn: async (values: SignInFormValues) => {
      const user =
        values.mode === 'owner'
          ? await signInWithEmail({
              email: values.email.trim().toLowerCase(),
              pin: values.pin,
              rememberMe: values.rememberMe,
            })
          : await signIn({ phone: values.phone, pin: values.pin, rememberMe: values.rememberMe });
      if (belongsToOtherApp(user.plan)) {
        await signOut();
        throw new WrongAppError();
      }
      return user;
    },
    onSuccess: (user) => {
      startSession(user);
      router.replace(homeRouteFor(user));
    },
  });

  if (mutation.isPending) return <LoadingView />;

  const errorText = (message?: string) => (message ? t(message, { count: PIN_LENGTH }) : undefined);

  return (
    <AuthBackground>
      <FormScreen plain>
        <View className="absolute left-5 top-4 z-10">
          <LanguageToggle />
        </View>
        {/* Design: assets/images/auth/reference-signin.png */}
        <View
          className="flex-1 items-center pb-6"
          style={{ paddingTop: 56, paddingHorizontal: 22 }}
        >
          <AuthLogo />
          <AuthTitle text={t('auth.welcomeBack')} />
          <AuthSubtitle text={t('auth.signInSubtitle')} />

          <AuthCard>
            {notice === 'pinReset' ? (
              <Text
                font="semibold"
                className="text-[15px]"
                style={{ color: colors.successFg }}
                accessibilityRole="alert"
              >
                {t('pin.reset.done')}
              </Text>
            ) : null}
            <Segmented
              options={[
                { value: 'owner', label: t('auth.ownerTab') },
                { value: 'staff', label: t('auth.staffTab') },
              ]}
              value={mode}
              onChange={(next) => {
                setValue('mode', next);
                clearErrors();
              }}
            />

            {mode === 'owner' ? (
              <Controller
                control={control}
                name="email"
                render={({ field }) => (
                  <Input
                    label={t('auth.email')}
                    labelIcon={Mail}
                    labelIconColor={auth.p}
                    round
                    placeholder={t('auth.emailPlaceholder')}
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="emailAddress"
                    autoComplete="email"
                    error={errorText(errors.email?.message)}
                  />
                )}
              />
            ) : (
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
            )}

            <Controller
              control={control}
              name="pin"
              render={({ field }) => (
                <Input
                  label={t('auth.pin')}
                  labelIcon={ShieldFilled}
                  labelIconColor={auth.p}
                  round
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

            <View className="flex-row items-center justify-between gap-2">
              <View className="flex-1">
                <Controller
                  control={control}
                  name="rememberMe"
                  render={({ field }) => (
                    <Checkbox
                      checked={field.value}
                      onChange={field.onChange}
                      accessibilityLabel={t('auth.rememberMe')}
                    >
                      <Text className="text-[15px]" style={{ color: AUTH.text }}>
                        {t('auth.rememberMe')}
                      </Text>
                    </Checkbox>
                  )}
                />
              </View>
              <Pressable
                onPress={() => router.push({ pathname: '/forgot-pin', params: { kind: mode } })}
                accessibilityRole="link"
                hitSlop={10}
                className="min-h-11 justify-center"
              >
                <Text font="bold" className="text-[15px]" style={{ color: auth.pt }}>
                  {t('auth.forgotPin')}
                </Text>
              </Pressable>
            </View>

            <PrimaryButton
              accent
              label={t('auth.signIn')}
              onPress={() => {
                Keyboard.dismiss();
                void handleSubmit((values) => mutation.mutate(values))();
              }}
            />
          </AuthCard>

          <AuthFooter
            prefix={t('auth.noAccount')}
            link={t('auth.signUp')}
            onPress={() => router.push('/create-account')}
            secure={t('brand.secure')}
          />
        </View>

        <ErrorDialog
          visible={mutation.isError}
          title={t('auth.errors.signInFailedTitle')}
          message={
            mutation.error instanceof WrongAppError
              ? t(isNormalApp ? 'wrongApp.body' : 'wrongApp.shopBody')
              : t(errorMessageKey(mutation.error))
          }
          actionLabel={t('errors.retry')}
          onClose={mutation.reset}
        />
      </FormScreen>
    </AuthBackground>
  );
}
