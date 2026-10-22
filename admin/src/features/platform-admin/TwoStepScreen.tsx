import { useMutation } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { hasAdminToken, verifyTwoStep } from '@/lib/admin';
import { ApiError } from '@/lib/api/client';
import { errorMessageKey } from '@/lib/errors';
import { colors } from '@/theme/tokens';

import { AuthFrame, fieldClass } from './AuthFrame';

/** Admin step 2: the authenticator code, or one backup code. */
export default function TwoStepScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [useBackup, setUseBackup] = useState(false);
  const [value, setValue] = useState('');

  const verify = useMutation({
    mutationFn: () => verifyTwoStep(useBackup ? { backupCode: value.trim() } : { code: value }),
    onSuccess: () => router.replace('/'),
    onError: (error) => {
      setValue('');
      // The step-1 session ended (too slow, or locked): start again.
      if (error instanceof ApiError && error.code === 'UNAUTHORIZED') {
        router.replace('/sign-in');
      }
    },
  });

  if (!hasAdminToken()) return <Redirect href="/sign-in" />;

  const error = verify.error;
  const triesLeft =
    error instanceof ApiError && error.code === 'WRONG_CODE'
      ? Number(error.details?.triesLeft ?? NaN)
      : NaN;
  const message = !error
    ? null
    : Number.isFinite(triesLeft)
      ? t('platformAdmin.errors.triesLeft', { count: triesLeft })
      : t(errorMessageKey(error));
  const ready = (useBackup ? value.trim().length >= 8 : /^\d{6}$/.test(value)) && !verify.isPending;
  const submit = () => {
    if (ready) verify.mutate();
  };

  return (
    <AuthFrame
      tagline={t('platformAdmin.twoStep.tagline')}
      taglineSub={t('platformAdmin.twoStep.taglineSub')}
    >
      <View className="gap-1">
        <Text font="heading" className="text-[28px]" accessibilityRole="header">
          {t('platformAdmin.twoStep.title')}
        </Text>
        <Text tone="muted" className="text-base">
          {useBackup ? t('platformAdmin.twoStep.lostPhone') : t('platformAdmin.twoStep.body')}
        </Text>
      </View>
      <TextInput
        value={value}
        onChangeText={(v) =>
          setValue(useBackup ? v.toUpperCase().slice(0, 9) : v.replace(/\D/g, '').slice(0, 6))
        }
        placeholder={useBackup ? t('platformAdmin.twoStep.backupPlaceholder') : '000000'}
        placeholderTextColor={colors.placeholder}
        keyboardType={useBackup ? 'default' : 'number-pad'}
        autoComplete="one-time-code"
        autoFocus
        accessibilityLabel={
          useBackup ? t('platformAdmin.twoStep.backup') : t('platformAdmin.twoStep.code')
        }
        className={`${fieldClass} text-center font-heading text-[28px] tracking-[8px]`}
        onSubmitEditing={submit}
      />
      {!useBackup ? (
        <Text tone="muted" className="text-sm">
          {t('platformAdmin.twoStep.changes')}
        </Text>
      ) : null}
      {message ? (
        <View className="rounded-input bg-dangerBg px-4 py-3" accessibilityLiveRegion="polite">
          <Text font="semibold" className="text-base text-dangerFg">
            {message}
          </Text>
        </View>
      ) : null}
      <Button label={t('platformAdmin.twoStep.signIn')} disabled={!ready} onPress={submit} />
      <Pressable
        onPress={() => {
          setUseBackup((b) => !b);
          setValue('');
          verify.reset();
        }}
        accessibilityRole="button"
        className="min-h-11 justify-center"
      >
        <Text font="bold" tone="link" className="text-base">
          {useBackup ? t('platformAdmin.twoStep.useApp') : t('platformAdmin.twoStep.useBackup')}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => router.replace('/sign-in')}
        accessibilityRole="button"
        className="min-h-11 justify-center"
      >
        <Text tone="muted" className="text-base">
          {t('platformAdmin.twoStep.back')}
        </Text>
      </Pressable>
    </AuthFrame>
  );
}
