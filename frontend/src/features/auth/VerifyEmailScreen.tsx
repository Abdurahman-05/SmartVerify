import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, Pressable, TextInput, View } from 'react-native';

import { AuthBackground } from '@/components/ui/AuthBackground';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { FormScreen } from '@/components/ui/FormScreen';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { Text } from '@/components/ui/Text';
import { createAccount } from '@/lib/auth';
import { errorMessageKey } from '@/lib/errors';
import {
  InvalidCodeError,
  peekSignup,
  sendEmailCode,
  takeSignup,
  verifyEmailCode,
} from '@/services/authService';
import { homeRouteFor, useSession } from '@/store/session';
import { colors } from '@/theme/tokens';
import { GlassCard, PrimaryButton } from '@/ui/glass';

import {
  AUTH,
  AuthCard,
  AuthLogo,
  AuthSubtitle,
  AuthTitle,
  SecureLine,
  useAuthColors,
} from './AuthParts';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 45;

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** Sign-up step: the 6-digit code sent to the owner's email, then Choose color → Choose plan. */
export default function VerifyEmailScreen() {
  const auth = useAuthColors();
  const { t } = useTranslation();
  const router = useRouter();
  const startSession = useSession((s) => s.signIn);
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const input = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const verify = useMutation({
    mutationFn: async (value: string) => {
      await verifyEmailCode(value);
      const values = peekSignup();
      if (!values) throw new Error('SIGNUP_LOST');
      return createAccount(values);
    },
    onSuccess: (user) => {
      takeSignup();
      startSession(user);
      // New owner: passcode / Choose color, then Choose plan.
      router.replace(homeRouteFor(user));
    },
    onError: (e) => {
      if (e instanceof InvalidCodeError) setError(t('auth.verify.wrongCode'));
    },
  });
  const resend = useMutation({
    mutationFn: () => sendEmailCode(email),
    onSuccess: () => {
      setCode('');
      setError(undefined);
      setSecondsLeft(RESEND_SECONDS);
    },
  });

  const submit = () => {
    Keyboard.dismiss();
    if (code.length < CODE_LENGTH) {
      setError(t('auth.verify.incomplete', { count: CODE_LENGTH }));
      return;
    }
    setError(undefined);
    verify.mutate(code);
  };
  // Back to Create account, which keeps what was typed.
  const changeEmail = () =>
    router.canGoBack() ? router.back() : router.replace('/create-account');

  return (
    <AuthBackground>
      <FormScreen plain>
        <View className="absolute left-5 right-5 top-4 z-10 flex-row items-center justify-between">
          <GlassCard
            radius={22}
            onPress={changeEmail}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            className="h-11 w-11 items-center justify-center"
          >
            <ChevronLeft size={22} color={colors.text} strokeWidth={2.2} />
          </GlassCard>
          <LanguageToggle />
        </View>
        <View
          className="flex-1 items-center pb-6"
          style={{ paddingTop: 56, paddingHorizontal: 22 }}
        >
          <AuthLogo />
          <AuthTitle text={t('auth.verify.title')} />
          <AuthSubtitle text={t('auth.verify.subtitle')} />
          <View
            className="mt-1 rounded-[12px] px-3"
            style={{ backgroundColor: 'rgba(255,255,255,0.72)' }}
          >
            <Text font="bold" className="text-center text-base" style={{ color: auth.p }}>
              {email}
            </Text>
          </View>

          <AuthCard>
            <Pressable
              onPress={() => input.current?.focus()}
              accessibilityLabel={t('auth.verify.codeLabel')}
              className="flex-row justify-between gap-2"
            >
              {Array.from({ length: CODE_LENGTH }, (_, i) => {
                const active = i === Math.min(code.length, CODE_LENGTH - 1);
                return (
                  <View
                    key={i}
                    className="h-14 flex-1 items-center justify-center rounded-[14px] bg-white/80"
                    style={{
                      borderWidth: 2,
                      borderColor: error
                        ? colors.dangerFg
                        : active
                          ? auth.p
                          : 'rgba(255,255,255,0.95)',
                    }}
                  >
                    <Text font="heading" className="text-[24px]" style={{ color: AUTH.text }}>
                      {code[i] ?? ''}
                    </Text>
                  </View>
                );
              })}
            </Pressable>
            <TextInput
              ref={input}
              value={code}
              onChangeText={(text) => {
                setCode(text.replace(/\D/g, '').slice(0, CODE_LENGTH));
                setError(undefined);
              }}
              autoFocus
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={CODE_LENGTH}
              accessibilityLabel={t('auth.verify.codeLabel')}
              style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
            />
            {error ? (
              <Text font="semibold" className="text-[15px] text-dangerFg">
                {error}
              </Text>
            ) : null}

            <PrimaryButton
              accent
              label={t('auth.verify.verify')}
              disabled={verify.isPending}
              onPress={submit}
            />

            <View className="flex-row items-center justify-between">
              <Pressable
                onPress={() => resend.mutate()}
                disabled={secondsLeft > 0 || resend.isPending}
                accessibilityRole="button"
                className="min-h-11 justify-center"
                style={{ opacity: secondsLeft > 0 ? 0.55 : 1 }}
              >
                <Text font="bold" className="text-[15px]" style={{ color: auth.pt }}>
                  {secondsLeft > 0
                    ? t('auth.verify.resendIn', { time: clock(secondsLeft) })
                    : t('auth.verify.resend')}
                </Text>
              </Pressable>
              <Pressable
                onPress={changeEmail}
                accessibilityRole="link"
                hitSlop={10}
                className="min-h-11 justify-center"
              >
                <Text font="bold" className="text-[15px]" style={{ color: auth.pt }}>
                  {t('auth.verify.change')}
                </Text>
              </Pressable>
            </View>
          </AuthCard>

          <SecureLine text={t('brand.secure')} style={{ marginTop: 14 }} />
        </View>
        <ErrorDialog
          visible={verify.isError && !(verify.error instanceof InvalidCodeError)}
          title={t('auth.errors.createFailedTitle')}
          message={t(errorMessageKey(verify.error))}
          actionLabel={t('errors.retry')}
          onClose={verify.reset}
        />
      </FormScreen>
    </AuthBackground>
  );
}
