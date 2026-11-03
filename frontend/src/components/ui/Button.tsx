import type { LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { colors } from '@/theme/tokens';

import { Text } from './Text';

type Variant = 'primary' | 'outline' | 'amber' | 'success' | 'danger' | 'secondary';
type Size = 'lg' | 'md';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  disabled?: boolean;
}

const containers: Record<Variant, string> = {
  primary: 'bg-primary',
  outline: 'bg-surface border-[2.5px] border-text',
  amber: 'bg-amber',
  success: 'bg-success',
  danger: 'bg-alert',
  secondary: 'bg-transparent border-[1.5px] border-borderMid',
};

const textColor: Record<Variant, string> = {
  primary: colors.surface,
  outline: colors.text,
  amber: colors.text,
  success: colors.surface,
  danger: colors.surface,
  secondary: colors.text,
};

const heights: Record<Size, string> = { lg: 'h-16', md: 'h-[52px]' };

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon: Icon,
  disabled = false,
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      className={`w-full rounded-button ${heights[size]} ${containers[variant]} ${disabled ? 'opacity-50' : 'active:opacity-80'}`}
    >
      <View className="flex-1 flex-row items-center justify-center gap-2 px-4">
        {/* One line always: on phones with large text the label shrinks a little instead of
            breaking out of the button. */}
        <Text
          font="bold"
          className="shrink text-[19px]"
          style={{ color: textColor[variant] }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {label}
        </Text>
        {Icon ? <Icon size={22} color={textColor[variant]} strokeWidth={2.4} /> : null}
      </View>
    </Pressable>
  );
}
