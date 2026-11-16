import type { LucideIcon } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { colors } from '@/theme/tokens';

import { useGlass } from './glassTokens';
import { Text } from './Text';

/** A choice pill or tile: selected = 2 px theme border, tile background, theme text. */
export function ChoicePill({
  label,
  icon: Icon,
  selected,
  onPress,
  tall,
}: {
  label: string;
  icon?: LucideIcon;
  selected: boolean;
  onPress: () => void;
  tall?: boolean;
}) {
  const g = useGlass();
  const fg = selected ? g.primaryText : colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      className={`flex-1 items-center justify-center active:opacity-80 ${
        tall ? 'h-16 gap-0.5 rounded-[18px] px-1' : 'h-12 flex-row gap-2 rounded-[24px] px-3'
      }`}
      style={{
        backgroundColor: selected ? g.tile : 'rgba(255,255,255,0.55)',
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? g.primary : 'rgba(255,255,255,0.9)',
      }}
    >
      {Icon ? <Icon size={tall ? 20 : 18} color={fg} strokeWidth={2.2} /> : null}
      <Text
        font="bold"
        className={tall ? 'text-[13px]' : 'text-[15px]'}
        style={{ color: fg }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {label}
      </Text>
    </Pressable>
  );
}
