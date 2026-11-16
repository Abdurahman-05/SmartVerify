import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentType } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { alpha, useGlass } from './glassTokens';
import { Text } from './Text';

export interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  icon?: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  disabled?: boolean;
  loading?: boolean;
}

/** 56 dp pill in the theme gradient with white bold text. */
export function PrimaryButton({
  label,
  onPress,
  icon: Icon,
  disabled,
  loading,
}: PrimaryButtonProps) {
  const g = useGlass();
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      className="active:opacity-85"
      style={{
        borderRadius: 28,
        opacity: disabled ? 0.5 : 1,
        boxShadow: `0 12px 24px ${alpha(g.primary, 0.3)}`,
      }}
    >
      <LinearGradient
        colors={[g.primary2, g.primary]}
        style={{ height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' }}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <View className="flex-row items-center gap-2 px-5">
            {Icon ? <Icon size={20} color="#FFFFFF" strokeWidth={2.4} /> : null}
            <Text font="bold" className="text-base text-white" numberOfLines={1}>
              {label}
            </Text>
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}
