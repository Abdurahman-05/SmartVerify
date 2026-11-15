import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useBrandColors } from '@/store/theme';

import { GlassCard } from './GlassCard';
import type { GlassButtonProps } from './PrimaryButton';

const heights = { xl: 56, lg: 54, md: 46 } as const;

/** The design's `.g.btn2`: glass surface, brand-text 16 px bold label, radius 16, height 54. */
export function SecondaryButton({
  label,
  onPress,
  icon: Icon,
  disabled = false,
  size = 'lg',
  trailing,
  accent = false,
}: GlassButtonProps) {
  const brand = useBrandColors();
  return (
    <GlassCard
      radius={16}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      className={`w-full ${disabled ? 'opacity-50' : ''} ${accent ? 'border-[1.5px]' : ''}`}
      style={[{ height: heights[size] }, accent ? { borderColor: brand.primaryText } : null]}
    >
      <View className="flex-1 flex-row items-center justify-center gap-2 px-4">
        {Icon ? <Icon size={20} color={brand.primaryText} strokeWidth={2.2} /> : null}
        <Text
          font="bold"
          className={`shrink ${size === 'md' ? 'text-[15px]' : 'text-base'}`}
          style={{ color: brand.primaryText }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {label}
        </Text>
        {trailing}
      </View>
    </GlassCard>
  );
}
