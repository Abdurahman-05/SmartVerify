import type { LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { colors } from '@/theme/tokens';

import { Text } from './Text';

type Variant = 'primary' | 'outline' | 'amber';
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
};

const textColor: Record<Variant, string> = {
  primary: colors.surface,
  outline: colors.text,
  amber: colors.text,
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
        <Text font="bold" className="text-[19px]" style={{ color: textColor[variant] }}>
          {label}
        </Text>
        {Icon ? <Icon size={22} color={textColor[variant]} strokeWidth={2.4} /> : null}
      </View>
    </Pressable>
  );
}
