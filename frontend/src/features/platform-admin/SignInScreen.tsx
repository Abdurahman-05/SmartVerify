import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { adminSignIn } from '@/lib/admin';
import { ApiError } from '@/lib/api/client';
import { errorMessageKey } from '@/lib/errors';
import { colors } from '@/theme/tokens';

import { AuthFrame, fieldClass } from './AuthFrame';

/** Admin step 1: email + password. Then the two-step code (or its first setup). */
export default function SignInScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const signIn = useMutation({
    mutationFn: () => adminSignIn(email.trim(), password),
    onSuccess: (next) => {
      setPassword('');
      router.replace(next === 'setup' ? '/console/two-step-setup' : '/console/two-step');
    },
  });
  const error = signIn.error;
  const message =
    error instanceof ApiError && error.code === 'WRONG_CREDENTIALS'
      ? t('platformAdmin.signIn.wrong')
      : error
        ? t(errorMessageKey(error))
        : null;
  const ready = /\S+@\S+\.\S+/.test(email.trim()) && password.length > 0 && !signIn.isPending;
  const submit = () => {
    if (ready) signIn.mutate();
  };

  return (
    <AuthFrame
      tagline={t('platformAdmin.signIn.tagline')}
      points={[
        t('platformAdmin.signIn.point1'),
        t('platformAdmin.signIn.point2'),
        t('platformAdmin.signIn.point3'),
      ]}
    >
      <View className="gap-1">
        <Text font="heading" className="text-[28px]" accessibilityRole="header">
          {t('platformAdmin.signIn.title')}
        </Text>
        <Text tone="muted" className="text-base">
          {t('platformAdmin.signIn.subtitle')}
        </Text>
      </View>
      <View className="gap-1.5">
        <Text font="bold" className="text-base">
          {t('platformAdmin.signIn.email')}
        </Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder={t('platformAdmin.signIn.emailPlaceholder')}
          placeholderTextColor={colors.placeholder}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          accessibilityLabel={t('platformAdmin.signIn.email')}
          className={fieldClass}
          onSubmitEditing={submit}
        />
      </View>
      <View className="gap-1.5">
        <Text font="bold" className="text-base">
          {t('platformAdmin.signIn.password')}
        </Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={t('platformAdmin.signIn.passwordPlaceholder')}
          placeholderTextColor={colors.placeholder}
          secureTextEntry
          autoComplete="current-password"
          accessibilityLabel={t('platformAdmin.signIn.password')}
          className={fieldClass}
          onSubmitEditing={submit}
        />
      </View>
      {message ? (
        <View className="rounded-input bg-dangerBg px-4 py-3" accessibilityLiveRegion="polite">
          <Text font="semibold" className="text-base text-dangerFg">
            {message}
          </Text>
        </View>
      ) : null}
      <Button label={t('platformAdmin.signIn.continue')} disabled={!ready} onPress={submit} />
      <Text tone="muted" className="text-sm">
        {t('platformAdmin.signIn.lockNote')}
      </Text>
      <Text tone="muted" className="text-sm">
        {t('platformAdmin.signIn.forgot')}
      </Text>
    </AuthFrame>
  );
}
