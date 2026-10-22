import { useMutation, useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Redirect, useRouter } from 'expo-router';
import { Check, Copy } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { SmallSpinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { confirmTwoStepSetup, hasAdminToken, startTwoStepSetup } from '@/lib/admin';
import { ApiError } from '@/lib/api/client';
import { errorMessageKey } from '@/lib/errors';
import { useBrandColors } from '@/store/theme';
import { colors } from '@/theme/tokens';

import { AuthFrame, fieldClass } from './AuthFrame';

/** "JBSWY3DPEHPK3PXP" -> "JBSW Y3DP EHPK 3PXP", easier to type. */
const grouped = (key: string) => key.replace(/(.{4})/g, '$1 ').trim();

/**
 * First sign-in: add the key to an authenticator app, type its first code, then save the
 * backup codes (shown only once).
 */
export default function TwoStepSetupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const brand = useBrandColors();
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState<'key' | 'codes' | null>(null);
  const [saved, setSaved] = useState(false);

  const setup = useQuery({
    queryKey: ['admin-two-step-setup'],
    queryFn: startTwoStepSetup,
    enabled: hasAdminToken(),
    // A new key on every call: never refetch it behind the admin's back.
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  });
  const confirm = useMutation({
    mutationFn: () => confirmTwoStepSetup(code),
    onError: (error) => {
      setCode('');
      if (error instanceof ApiError && error.code === 'UNAUTHORIZED') {
        router.replace('/sign-in');
      }
    },
  });

  if (!hasAdminToken() && !confirm.data) return <Redirect href="/sign-in" />;
  if (setup.isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <SmallSpinner />
      </View>
    );
  }

  const copy = (text: string, what: 'key' | 'codes') =>
    void Clipboard.setStringAsync(text).then(() => {
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    });

  const backupCodes = confirm.data;
  const error = setup.error ?? confirm.error;
  const triesLeft =
    error instanceof ApiError && error.code === 'WRONG_CODE'
      ? Number(error.details?.triesLeft ?? NaN)
      : NaN;
  const message = !error
    ? null
    : Number.isFinite(triesLeft)
      ? t('platformAdmin.errors.triesLeft', { count: triesLeft })
      : t(errorMessageKey(error));
  const ready = /^\d{6}$/.test(code) && !confirm.isPending;

  return (
    <AuthFrame
      tagline={t('platformAdmin.setup.tagline')}
      taglineSub={t('platformAdmin.setup.taglineSub')}
    >
      <Text font="heading" className="text-[28px]" accessibilityRole="header">
        {t('platformAdmin.setup.title')}
      </Text>

      {backupCodes ? (
        <>
          <View className="gap-1">
            <Text font="bold" className="text-lg">
              {t('platformAdmin.setup.codesTitle')}
            </Text>
            <Text tone="muted" className="text-base">
              {t('platformAdmin.setup.codesBody')}
            </Text>
          </View>
          <View className="flex-row flex-wrap gap-2.5 rounded-[18px] border-[1.5px] border-border bg-surface p-4">
            {backupCodes.map((c) => (
              <Text key={c} font="heading" className="w-[46%] text-lg" selectable>
                {c}
              </Text>
            ))}
          </View>
          <Button
            label={
              copied === 'codes'
                ? t('platformAdmin.setup.copied')
                : t('platformAdmin.setup.copyCodes')
            }
            icon={copied === 'codes' ? Check : Copy}
            variant="outline"
            size="md"
            onPress={() => copy(backupCodes.join('\n'), 'codes')}
          />
          <Checkbox
            checked={saved}
            onChange={setSaved}
            accessibilityLabel={t('platformAdmin.setup.saved')}
          >
            <Text className="flex-1 text-base">{t('platformAdmin.setup.saved')}</Text>
          </Checkbox>
          <Button
            label={t('platformAdmin.setup.done')}
            disabled={!saved}
            onPress={() => router.replace('/')}
          />
        </>
      ) : (
        <>
          <View className="gap-2">
            <Text font="bold" className="text-lg">
              1. {t('platformAdmin.setup.step1')}
            </Text>
            <Text tone="muted" className="text-base">
              {t('platformAdmin.setup.step1Body')}
            </Text>
            {setup.data ? (
              <View className="flex-row items-center gap-3 rounded-[18px] border-[1.5px] border-border bg-surface p-3">
                <Text font="heading" className="flex-1 text-xl" selectable>
                  {grouped(setup.data.secret)}
                </Text>
                <Pressable
                  onPress={() => copy(setup.data.secret, 'key')}
                  accessibilityRole="button"
                  accessibilityLabel={t('platformAdmin.setup.copyKey')}
                  className="h-11 flex-row items-center gap-1 rounded-[22px] border-2 border-borderStrong bg-surface px-3"
                >
                  {copied === 'key' ? (
                    <Check size={18} color={colors.success} strokeWidth={2.6} />
                  ) : (
                    <Copy size={18} color={brand.primary} strokeWidth={2.2} />
                  )}
                  <Text font="bold" tone="link" className="text-sm">
                    {copied === 'key'
                      ? t('platformAdmin.setup.copied')
                      : t('platformAdmin.setup.copyKey')}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
          <View className="gap-2">
            <Text font="bold" className="text-lg">
              2. {t('platformAdmin.setup.step2')}
            </Text>
            <TextInput
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              placeholderTextColor={colors.placeholder}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              accessibilityLabel={t('platformAdmin.twoStep.code')}
              className={`${fieldClass} text-center font-heading text-[28px] tracking-[8px]`}
              onSubmitEditing={() => ready && confirm.mutate()}
            />
          </View>
          {message ? (
            <View className="rounded-input bg-dangerBg px-4 py-3" accessibilityLiveRegion="polite">
              <Text font="semibold" className="text-base text-dangerFg">
                {message}
              </Text>
            </View>
          ) : null}
          <Button
            label={t('platformAdmin.setup.confirm')}
            disabled={!ready || !setup.data}
            onPress={() => confirm.mutate()}
          />
        </>
      )}
    </AuthFrame>
  );
}
