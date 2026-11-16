import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { alpha, useGlass } from './glassTokens';

export interface GlassCardProps {
  children?: ReactNode;
  radius?: number;
  /** Inner layout (padding, gap, flexDirection...). */
  style?: StyleProp<ViewStyle>;
  /** Outer box (margins, width, flex). */
  containerStyle?: StyleProp<ViewStyle>;
  onPress?: () => void;
  /** A 2 px border in this colour (e.g. the open item). */
  highlight?: string;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'radio' | 'tab';
  accessibilityState?: { selected?: boolean; disabled?: boolean };
}

/** Frosted white card: blur, a white 135° sheen, a white hairline and a soft theme shadow. */
export function GlassCard({
  children,
  radius = 22,
  style,
  containerStyle,
  onPress,
  highlight,
  ...a11y
}: GlassCardProps) {
  const g = useGlass();
  const outer: ViewStyle = {
    borderRadius: radius,
    boxShadow: `0 10px 30px ${alpha(g.primary, 0.16)}`,
  };
  const body = (
    <View
      style={{
        borderRadius: radius,
        overflow: 'hidden',
        borderWidth: highlight ? 2 : 1,
        borderColor: highlight ?? 'rgba(255,255,255,0.8)',
      }}
    >
      <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(255,255,255,0.58)', 'rgba(255,255,255,0.20)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={style}>{children}</View>
    </View>
  );
  if (!onPress) return <View style={[outer, containerStyle]}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={a11y.accessibilityRole ?? 'button'}
      accessibilityLabel={a11y.accessibilityLabel}
      accessibilityState={a11y.accessibilityState}
      style={({ pressed }) => [outer, containerStyle, pressed && { opacity: 0.8 }]}
    >
      {body}
    </Pressable>
  );
}
