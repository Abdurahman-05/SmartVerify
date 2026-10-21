import { Check } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors } from '@/theme/tokens';

/** The admin's sign-in pages: brand panel on the left, the form on the right (stacked when narrow). */
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
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="min-h-full flex-row flex-wrap"
    >
      <View className="min-h-[320px] flex-1 basis-[420px] justify-between gap-10 bg-primary p-10">
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
        <View className="max-w-[440px] gap-4">
          <Text font="heading" tone="inverse" className="text-[34px] leading-[42px]">
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
      <View className="flex-1 basis-[420px] items-center justify-center p-8">
        <View className="w-full max-w-[420px] gap-5">{children}</View>
      </View>
    </ScrollView>
  );
}

/** A labelled text field in the admin's look (keyboard Enter submits). */
export const fieldClass =
  'h-14 rounded-input border-2 border-borderStrong bg-surface px-4 font-body text-lg text-text';
