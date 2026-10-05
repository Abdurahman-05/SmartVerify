import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { colors } from '@/theme/tokens';

import { Text } from './Text';

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
}

export function ScreenHeader({ title, onBack, right }: ScreenHeaderProps) {
  const { t } = useTranslation();

  return (
    <View className={`min-h-14 flex-row items-center gap-1.5 pb-2 pr-4 pt-4 ${onBack ? 'pl-2.5' : 'pl-4'}`}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          className="h-11 w-11 items-center justify-center rounded-full active:bg-border"
        >
          <ChevronLeft size={28} color={colors.text} strokeWidth={2} />
        </Pressable>
      ) : null}
      <Text font="heading" className="flex-1 text-[22px]" accessibilityRole="header" numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  );
}
