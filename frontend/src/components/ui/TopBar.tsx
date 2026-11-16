import type { ComponentType } from 'react';
import { View } from 'react-native';

import { colors } from '@/theme/tokens';

import { GlassCard } from './GlassCard';
import { Text } from './Text';

export interface TopBarAction {
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  onPress: () => void;
  /** Read out by screen readers (the button has no text). */
  label: string;
}

function CircleButton({ icon: Icon, onPress, label }: TopBarAction) {
  return (
    <GlassCard
      radius={22}
      onPress={onPress}
      accessibilityLabel={label}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon size={22} color={colors.text} strokeWidth={2.2} />
    </GlassCard>
  );
}

/** 44 dp glass circle (or spacer) · centred title and subtitle · 44 dp glass circle (or spacer). */
export function TopBar({
  title,
  subtitle,
  left,
  right,
}: {
  title: string;
  subtitle?: string;
  left?: TopBarAction;
  right?: TopBarAction;
}) {
  return (
    <View className="flex-row items-center gap-3">
      {left ? <CircleButton {...left} /> : <View className="h-11 w-11" />}
      <View className="flex-1 items-center">
        <Text
          font="heading"
          className="text-center text-xl"
          numberOfLines={1}
          accessibilityRole="header"
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            className="text-center text-[13px]"
            style={{ color: colors.muted }}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <CircleButton {...right} /> : <View className="h-11 w-11" />}
    </View>
  );
}
