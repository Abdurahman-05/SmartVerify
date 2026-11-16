import type { ComponentType, ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { alpha, useGlass } from './glassTokens';
import { Text } from './Text';

export interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  icon?: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  disabled?: boolean;
  loading?: boolean;
  /** 56 by default; the Home "Verify payment" button is 60. */
  height?: number;
  /** Shown after the label, e.g. a small count tag. */
  trailing?: ReactNode;
}

/** 56 dp pill in the theme gradient with white bold text. */
export function PrimaryButton({
  label,
  onPress,
  icon: Icon,
  disabled,
  loading,
  height = 56,
  trailing,
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
        borderRadius: height / 2,
        opacity: disabled ? 0.5 : 1,
        boxShadow: `0 12px 24px ${alpha(g.primary, 0.3)}`,
      }}
    >
      <View
        style={[
          { height, borderRadius: height / 2, alignItems: 'center', justifyContent: 'center' },
          { backgroundColor: g.primaryDeep },
        ]}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <View className="flex-row items-center gap-2 px-5">
            {Icon ? <Icon size={20} color="#FFFFFF" strokeWidth={2.4} /> : null}
            <Text font="bold" className="text-base text-white" numberOfLines={1}>
              {label}
            </Text>
            {trailing}
          </View>
        )}
      </View>
    </Pressable>
  );
}
