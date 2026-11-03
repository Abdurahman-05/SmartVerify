import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';

/**
 * Header button that opens the CalendarSheet: a calendar page in the brand colour, two rings on
 * top, the chosen day's number (today's for a period) in white in the middle.
 */
export function CalendarButton({ day, onPress }: { day: Date | null; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('period.choose')}
      className="h-11 w-11 items-center active:opacity-80"
    >
      <View className="mt-1 h-10 w-10 items-center justify-center rounded-[11px] bg-primary">
        <Text font="bold" tone="inverse" className="text-[17px] leading-tight">
          {(day ?? new Date()).getDate()}
        </Text>
      </View>
      <View className="absolute top-0 w-full flex-row justify-center gap-4">
        <View className="h-2.5 w-[5px] rounded-full border border-surface bg-primary" />
        <View className="h-2.5 w-[5px] rounded-full border border-surface bg-primary" />
      </View>
    </Pressable>
  );
}
