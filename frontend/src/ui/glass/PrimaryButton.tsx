import type { LucideIcon } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
  /** Primary: Sign in / Sign up design button (54 px pill, fixed orange gradient). Secondary: brand outline. */
  accent?: boolean;
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
}: GlassButtonProps) {
  const brand = useBrandColors();
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
        { height, borderRadius: radius, backgroundColor: accent ? '#EA580C' : brand.primary },
        accent ? styles.accentShadow : null,
      ]}
    >
      {accent ? (
        <LinearGradient
          pointerEvents="none"
          colors={['#F97316', '#EA580C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        />
      ) : null}
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
  accentShadow: {
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 12px 24px rgba(234,88,12,0.32)',
  },
});
