import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { colors } from '@/theme/tokens';
import { GlassCard } from '@/ui/glass/GlassCard';

import { Text } from './Text';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}

/** Light glass header: round 44 px glass back button, 26 px Sora title, muted 14 px subtitle. */
export function ScreenHeader({ title, subtitle, onBack, right }: ScreenHeaderProps) {
  const { t } = useTranslation();

  return (
    <View className="min-h-14 flex-row items-center gap-2.5 px-4 pb-3 pt-4">
      {onBack ? (
        <GlassCard
          radius={22}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          className="h-11 w-11 items-center justify-center"
        >
          <ChevronLeft size={22} color={colors.text} strokeWidth={2.2} />
        </GlassCard>
      ) : null}
      <View className="flex-1">
        <Text
          font="heading"
          className="text-[26px] leading-[32px]"
          accessibilityRole="header"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text tone="muted" className="text-sm" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}
