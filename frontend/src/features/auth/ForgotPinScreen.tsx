import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Crown, Mail, Users, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Input } from '@/components/ui/Input';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { digitsOnly, formatPhone, PHONE_DIGITS } from '@/lib/format';
import { errorMessageKey } from '@/lib/errors';
import { requestPinReset, StaffResetByManagerError } from '@/services/authService';
import { useBrandColors } from '@/store/theme';
import { colors } from '@/theme/tokens';
import { GlassCard, PrimaryButton, ScreenBg } from '@/ui/glass';

function HelpCard({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  const brand = useBrandColors();
  return (
    <GlassCard className="flex-row items-start gap-3 px-4 py-3.5" accessible>
      <View className="h-11 w-11 items-center justify-center rounded-[12px] bg-primaryTile">
        <Icon size={22} color={brand.primary} strokeWidth={2.2} />
      </View>
      <View className="min-w-0 flex-1 gap-1">
        <Text font="bold" className="text-[17px]">
          {title}
        </Text>
        <Text tone="muted" className="text-base leading-6">
          {body}
        </Text>
      </View>
    </GlassCard>
  );
}

/**
 * Forgot PIN. A self-service reset needs a code sent by SMS to prove the phone belongs to the
 * person; until that exists, this explains who can help.
 */
export default function ForgotPinScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  // Owner and manager reset by email; staff by phone.
  const byEmail = kind !== 'staff';
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const reset = useMutation({ mutationFn: requestPinReset });
  const send = () => {
    Keyboard.dismiss();
    const ok = byEmail
      ? /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
      : /^[79]\d{8}$/.test(value);
    if (!ok) {
      setError(t(byEmail ? 'auth.errors.email' : 'auth.errors.phone'));
      return;
    }
    setError(undefined);
    setSentTo(null);
    const shown = byEmail ? value.trim().toLowerCase() : `+251 ${formatPhone(value)}`;
    reset.mutate(
      { kind: byEmail ? 'owner' : 'staff', value: byEmail ? value.trim().toLowerCase() : value },
      { onSuccess: () => setSentTo(shown) }
    );
  };
  const brand = useBrandColors();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/sign-in'));

  return (
    <ScreenBg>
      <SafeAreaView className="flex-1">
        <ScreenHeader
          title={t('pin.forgot.title')}
          subtitle={t('pin.forgot.subtitle')}
          onBack={goBack}
        />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, gap: 12, paddingHorizontal: 16, paddingTop: 4 }}
        >
          <GlassCard className="gap-3 px-4 py-4">
            <Text tone="muted" className="text-base leading-6">
              {t(byEmail ? 'pin.forgot.emailPrompt' : 'pin.forgot.phonePrompt')}
            </Text>
            {byEmail ? (
              <Input
                label={t('auth.email')}
                labelIcon={Mail}
                labelIconColor={brand.primaryDeep}
                placeholder={t('auth.emailPlaceholder')}
                value={value}
                onChangeText={(text) => setValue(text)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                error={error}
              />
            ) : (
              <Input
                label={t('auth.phone')}
                prefix="+251"
                placeholder={t('auth.phonePlaceholder')}
                value={formatPhone(value)}
                onChangeText={(text) => setValue(digitsOnly(text, PHONE_DIGITS))}
                keyboardType="number-pad"
                maxLength={11}
                error={error}
              />
            )}
            {reset.isError ? (
              <Text
                font="semibold"
                className="text-[15px]"
                style={{ color: colors.dangerFg }}
                accessibilityRole="alert"
              >
                {t(
                  reset.error instanceof StaffResetByManagerError
                    ? 'pin.forgot.staffBody'
                    : errorMessageKey(reset.error)
                )}
              </Text>
            ) : sentTo ? (
              <Text font="semibold" className="text-[15px]" style={{ color: colors.successFg }}>
                {t('pin.forgot.sent', { value: sentTo })}
              </Text>
            ) : null}
            <PrimaryButton label={t('pin.forgot.send')} disabled={reset.isPending} onPress={send} />
          </GlassCard>
          <HelpCard
            icon={Users}
            title={t('pin.forgot.staffTitle')}
            body={t('pin.forgot.staffBody')}
          />
          <HelpCard
            icon={Crown}
            title={t('pin.forgot.ownerTitle')}
            body={t('pin.forgot.ownerBody')}
          />
          <View className="min-h-6 flex-1" />
          <View className="pb-6">
            <PrimaryButton label={t('pin.forgot.back')} onPress={goBack} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </ScreenBg>
  );
}
