import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Holds a screen's main button(s) floating 20 dp above the bottom (plus the safe area). */
export function StickyFooter({ children }: { children?: ReactNode }) {
  const { bottom } = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 16, right: 16, bottom: 20 + bottom, gap: 8 }}
    >
      {children}
    </View>
  );
}
