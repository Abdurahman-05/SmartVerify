import { CalendarDays } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { colors } from '@/theme/tokens';
import { GlassCard } from '@/ui/glass/GlassCard';

/**
 * Header button that opens the CalendarSheet (design: round 44 px glass button with a calendar
 * icon). `day` is kept for callers; the chosen day is shown in the screen's subtitle.
 */
export function CalendarButton({ onPress }: { day: Date | null; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <GlassCard
      radius={22}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('period.choose')}
      className="h-11 w-11 items-center justify-center"
    >
      <CalendarDays size={20} color={colors.text} strokeWidth={2} />
    </GlassCard>
  );
}
