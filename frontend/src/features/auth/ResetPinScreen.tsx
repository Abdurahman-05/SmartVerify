import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Input } from '@/components/ui/Input';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { errorMessageKey } from '@/lib/errors';
import { digitsOnly } from '@/lib/format';
import {
  InvalidCodeError,
  PinLengthError,
  requestPinReset,
  resetPin,
} from '@/services/authService';
import { colors } from '@/theme/tokens';
import { GlassCard, PrimaryButton, ScreenBg, SecondaryButton } from '@/ui/glass';

import { PIN_LENGTH, STAFF_PIN_LENGTH } from './schemas';

const CODE_LENGTH = 6;

/** Forgot PIN, step 2: the emailed code and the new PIN twice. Success goes to Sign in. */
export default function ResetPinScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const [formError, setFormError] = useState<string | undefined>();
  const [newCodeSent, setNewCodeSent] = useState(false);

  const save = useMutation({
    mutationFn: () => resetPin(email, code, pin),
    onSuccess: () => router.replace({ pathname: '/sign-in', params: { notice: 'pinReset' } }),
  });
  const resend = useMutation({
    mutationFn: () => requestPinReset({ kind: 'owner', value: email }),
    onSuccess: () => {
      save.reset();
      setCode('');
      setNewCodeSent(true);
    },
  });

  const submit = () => {
    Keyboard.dismiss();
    setNewCodeSent(false);
    if (code.length !== CODE_LENGTH) return setFormError(t('pin.reset.codeLength'));
    if (pin.length < STAFF_PIN_LENGTH) return setFormError(t('auth.errors.signInPin'));
    if (pin !== again) return setFormError(t('pin.errors.mismatch'));
    setFormError(undefined);
    save.mutate();
  };

  const codeProblem = save.error instanceof InvalidCodeError ? save.error.reason : null;
  const saveError = codeProblem
    ? t(`pin.reset.${codeProblem}`)
    : save.error instanceof PinLengthError
      ? t('pin.errors.length', { count: save.error.length })
      : save.isError
        ? t(errorMessageKey(save.error))
        : undefined;
  const message = formError ?? saveError;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/forgot-pin'));

  return (
    <ScreenBg>
      <SafeAreaView className="flex-1">
        <ScreenHeader
          title={t('pin.reset.title')}
          subtitle={t('pin.reset.subtitle', { email })}
          onBack={goBack}
        />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            gap: 12,
            paddingHorizontal: 16,
            paddingTop: 4,
            paddingBottom: 24,
          }}
        >
          <GlassCard className="gap-3 px-4 py-4">
            <Input
              label={t('pin.reset.code')}
              placeholder="000000"
              value={code}
              onChangeText={(text) => setCode(digitsOnly(text, CODE_LENGTH))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={CODE_LENGTH}
            />
            <Input
              label={t('pin.new')}
              placeholder={t('pin.reset.pinHint')}
              value={pin}
              onChangeText={(text) => setPin(digitsOnly(text, PIN_LENGTH))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={PIN_LENGTH}
            />
            <Input
              label={t('pin.confirm')}
              value={again}
              onChangeText={(text) => setAgain(digitsOnly(text, PIN_LENGTH))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={PIN_LENGTH}
            />
            {message ? (
              <Text
                font="semibold"
                className="text-[15px]"
                style={{ color: colors.dangerFg }}
                accessibilityRole="alert"
              >
                {message}
              </Text>
            ) : newCodeSent ? (
              <Text font="semibold" className="text-[15px]" style={{ color: colors.successFg }}>
                {t('pin.forgot.sent', { value: email })}
              </Text>
            ) : resend.isError ? (
              <Text font="semibold" className="text-[15px]" style={{ color: colors.dangerFg }}>
                {t(errorMessageKey(resend.error))}
              </Text>
            ) : null}
            <PrimaryButton label={t('pin.save')} disabled={save.isPending} onPress={submit} />
            {codeProblem ? (
              <SecondaryButton
                label={t('pin.reset.sendNew')}
                disabled={resend.isPending}
                onPress={() => resend.mutate()}
              />
            ) : null}
          </GlassCard>
        </ScrollView>
      </SafeAreaView>
    </ScreenBg>
  );
}
