import type { ComponentType } from 'react';
import { View } from 'react-native';

import { GlassCard } from './GlassCard';
import { useGlass } from './glassTokens';
import { Text } from './Text';

export interface GhostButtonProps {
  label: string;
  onPress: () => void;
  icon?: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}

/** Glass pill button with the label in the theme's text colour. */
export function GhostButton({ label, onPress, icon: Icon }: GhostButtonProps) {
  const g = useGlass();
  return (
    <GlassCard
      radius={28}
      onPress={onPress}
      accessibilityLabel={label}
      style={{ height: 56, alignItems: 'center', justifyContent: 'center' }}
    >
      <View className="flex-row items-center gap-2 px-5">
        {Icon ? <Icon size={20} color={g.primaryText} strokeWidth={2.4} /> : null}
        <Text font="bold" className="text-base" style={{ color: g.primaryText }} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </GlassCard>
  );
}
