import { BlurView } from 'expo-blur';
import { Pressable, StyleSheet, View, type PressableProps, type ViewProps } from 'react-native';

import { glass } from './glassColors';

export type GlassCardProps = ViewProps &
  Pick<
    PressableProps,
    'onPress' | 'onLongPress' | 'disabled' | 'accessibilityRole' | 'accessibilityState'
  > & {
    /** Corner radius; 20 for cards (design `.g`). */
    radius?: number;
    /** Real blur of what is behind (only for things floating over content, like the nav). */
    blur?: boolean;
  };

/**
 * The design's `.g` surface: white at 62%, a bright hairline border, a white top highlight and a
 * soft drop shadow. With `onPress` it is a pressable card (same props as Pressable).
 */
export function GlassCard({
  radius = 20,
  blur = false,
  style,
  children,
  onPress,
  onLongPress,
  className,
  ...props
}: GlassCardProps) {
  // A caller's own border classes (e.g. the selected plan) replace the white hairline.
  const border = /(^|\s)border-/.test(className ?? '') ? '' : 'border border-white/95';
  const surface = [styles.surface, { borderRadius: radius }, style];
  const layer = blur ? (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: radius }]}
    >
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
    </View>
  ) : null;
  if (onPress || onLongPress) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        className={`active:opacity-80 ${border} ${className ?? ''}`}
        style={surface}
        {...props}
      >
        {layer}
        {children}
      </Pressable>
    );
  }
  return (
    <View className={`${border} ${className ?? ''}`} style={surface} {...props}>
      {layer}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    backgroundColor: glass.card,
    // boxShadow (not elevation): elevation draws a grey shape through see-through cards on Android.
    boxShadow: 'inset 0 1px 0 #FFFFFF, 0 10px 26px rgba(30,20,25,0.08)',
  },
  clip: { overflow: 'hidden' },
});
