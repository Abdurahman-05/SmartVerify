import { Text } from '@/components/ui/Text';
import { useBrandColors } from '@/store/theme';
import { GlassCard } from '@/ui/glass/GlassCard';

interface PillProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  role?: 'radio' | 'checkbox';
  dark?: boolean;
  /** Soft style (order and expense forms): chosen = tile background, brand border and text. */
  soft?: boolean;
}

/**
 * The design's glass `.chip` (height 44, radius 22, 15 px bold). Chosen = filled brand color with
 * white text (periods, filters), or the soft tile style. Used for periods, categories and notes.
 */
export function Pill({ label, selected, onPress, role = 'radio', dark = false, soft }: PillProps) {
  const brand = useBrandColors();
  const on = dark ? '#1E1A1C' : soft ? brand.primary : brand.primaryDeep;
  const chosen = soft
    ? { backgroundColor: brand.tile, borderWidth: 2, borderColor: on }
    : { backgroundColor: on, borderWidth: 1, borderColor: on };
  return (
    <GlassCard
      radius={22}
      onPress={onPress}
      accessibilityRole={role}
      accessibilityState={role === 'radio' ? { selected } : { checked: selected }}
      className="h-11 justify-center px-3.5"
      style={selected ? chosen : null}
    >
      <Text
        font="bold"
        className="text-[15px]"
        style={selected ? { color: soft ? on : '#FFFFFF' } : null}
      >
        {label}
      </Text>
    </GlassCard>
  );
}
