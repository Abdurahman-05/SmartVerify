import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useGlass } from './glassTokens';

/** Big theme-gradient card with white content and a faint circle at the bottom-right. */
export function HeroCard({
  children,
  style,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const g = useGlass();
  return (
    <LinearGradient
      colors={[g.primary2, g.primary, g.primaryText]}
      locations={[0, 0.58, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={[{ borderRadius: 26, padding: 18, overflow: 'hidden' }, style]}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: -60,
          bottom: -80,
          width: 200,
          height: 200,
          borderRadius: 100,
          backgroundColor: 'rgba(255,255,255,0.1)',
        }}
      />
      {children}
    </LinearGradient>
  );
}

/** See-through white chip for use inside a HeroCard. */
export function HeroChip({
  children,
  style,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          borderRadius: 14,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.35)',
          backgroundColor: 'rgba(255,255,255,0.2)',
          paddingHorizontal: 12,
          paddingVertical: 8,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
