import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useGlass } from './glassTokens';

/** Big card in the flat deep theme colour with white content. */
export function HeroCard({
  children,
  style,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const g = useGlass();
  return (
    <View
      style={[
        { borderRadius: 26, padding: 18, overflow: 'hidden', backgroundColor: g.primaryDeep },
        style,
      ]}
    >
      {children}
    </View>
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
