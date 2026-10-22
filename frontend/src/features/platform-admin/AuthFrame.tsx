import { Check } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, useWindowDimensions, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors } from '@/theme/tokens';

/** At this width and wider the brand panel sits beside the form. */
const WIDE = 900;

function Brand() {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-11 w-11 items-center justify-center rounded-xl bg-amber">
        <Check size={24} color={colors.primary} strokeWidth={3} />
      </View>
      <View>
        <Text font="heading" tone="inverse" className="text-xl">
          {t('platformAdmin.brand')}
        </Text>
        <Text tone="inverse" className="text-sm opacity-80">
          {t('platformAdmin.admin')}
        </Text>
      </View>
    </View>
  );
}

/**
 * The admin's sign-in pages. Wide screens: brand panel (full height) beside the form, centred.
 * Phones: a short brand header, then the form.
 */
export function AuthFrame({
  tagline,
  taglineSub,
  points,
  children,
}: {
  tagline: string;
  taglineSub?: string;
  points?: string[];
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const wide = width >= WIDE;

  const form = (
    <View className="w-full max-w-[440px] gap-5 rounded-3xl border-[1.5px] border-border bg-surface p-8 shadow-sm">
      {children}
    </View>
  );

  if (!wide) {
    return (
      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ minHeight: height }}>
        <View className="gap-3 bg-primary px-5 pb-8 pt-6">
          <Brand />
          <Text font="heading" tone="inverse" className="text-2xl">
            {tagline}
          </Text>
        </View>
        <View className="-mt-4 flex-1 items-center px-4 pb-8">{form}</View>
        <Text tone="muted" className="px-5 pb-6 text-center text-sm">
          {t('platformAdmin.teamOnly')}
        </Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ minHeight: height }}>
      <View className="flex-1 flex-row" style={{ minHeight: height }}>
        <View className="w-[45%] max-w-[640px] justify-between bg-primary p-12">
          <Brand />
          <View className="max-w-[460px] gap-5">
            <Text font="heading" tone="inverse" className="text-[40px] leading-[48px]">
              {tagline}
            </Text>
            {taglineSub ? (
              <Text tone="inverse" className="text-lg opacity-90">
                {taglineSub}
              </Text>
            ) : null}
            {points?.map((point) => (
              <View key={point} className="flex-row items-center gap-3">
                <View className="h-7 w-7 items-center justify-center rounded-full bg-white/15">
                  <Check size={16} color={colors.amber} strokeWidth={3} />
                </View>
                <Text tone="inverse" className="text-base">
                  {point}
                </Text>
              </View>
            ))}
          </View>
          <Text tone="inverse" className="text-sm opacity-80">
            {t('platformAdmin.teamOnly')}
          </Text>
        </View>
        <View className="flex-1 items-center justify-center p-10">{form}</View>
      </View>
    </ScrollView>
  );
}

/** A labelled text field in the admin's look (keyboard Enter submits). */
export const fieldClass =
  'h-14 rounded-input border-2 border-borderStrong bg-surface px-4 font-body text-lg text-text';
