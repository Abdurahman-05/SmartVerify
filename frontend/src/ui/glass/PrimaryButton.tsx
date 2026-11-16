import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useBrandColors } from '@/store/theme';

export interface GlassButtonProps {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  disabled?: boolean;
  /** xl = 60 (Home "Verify payment"), lg = 58 (design .btn), md = 48. */
  size?: 'xl' | 'lg' | 'md';
  /** Extra content after the label (e.g. a small pill). */
  trailing?: ReactNode;
  /** Sign in / Sign up design button: 54 px pill in the theme gradient. */
  accent?: boolean;
  /** Colours instead of the theme; the button is flat in the last one. */
  gradient?: readonly [string, string];
}

export const buttonHeights = { xl: 60, lg: 58, md: 48 } as const;

/** The design's `.btn`: solid brand color, white 17 px bold label, radius 16, soft shadow. */
export function PrimaryButton({
  label,
  onPress,
  icon: Icon,
  disabled = false,
  size = 'lg',
  trailing,
  accent = false,
  gradient: customGradient,
}: GlassButtonProps) {
  const brand = useBrandColors();
  // Flat fill: the deep theme colour (or the last colour of a given gradient, e.g. a preview).
  const fill = customGradient ? customGradient[customGradient.length - 1] : brand.primaryDeep;
  const height = accent ? 54 : buttonHeights[size];
  const radius = accent ? height / 2 : 16;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      className={`w-full ${disabled ? 'opacity-50' : 'active:opacity-85'}`}
      style={[
        styles.button,
        { height, borderRadius: radius, backgroundColor: fill },
        accent
          ? {
              // Theme-coloured glow (8-digit hex: 0x52 = 32 % alpha).
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35), 0 12px 24px ${brand.primary}52`,
            }
          : null,
      ]}
    >
      <View className="flex-1 flex-row items-center justify-center gap-2 px-4">
        {Icon ? <Icon size={22} color="#FFFFFF" strokeWidth={2.2} /> : null}
        <Text
          font="bold"
          className={`shrink ${accent ? 'text-lg' : size === 'md' ? 'text-[15px]' : 'text-[17px]'}`}
          style={{ color: '#FFFFFF' }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {label}
        </Text>
        {trailing}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: 16, boxShadow: '0 10px 22px rgba(30,20,25,0.18)' },
});
