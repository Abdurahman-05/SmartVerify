import { createContext, useContext, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { ScreenBackground } from '@/components/ui/ScreenBackground';

/**
 * true inside an area that already has one background (the tab screens): screens there draw none
 * of their own, so the background runs on unbroken under the floating nav.
 */
export const ScreenBgProvided = createContext(false);

interface ScreenBgProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Colours instead of the saved theme (the result screens' mint or soft red). */
  palette?: { tint: string; tile: string };
}

/** The app's one screen background (ScreenBackground); none inside an area that has one. */
export function ScreenBg({ children, style, palette }: ScreenBgProps) {
  const provided = useContext(ScreenBgProvided);
  if (provided && !palette) return <View style={[{ flex: 1 }, style]}>{children}</View>;
  return (
    <ScreenBackground style={style} palette={palette}>
      {children}
    </ScreenBackground>
  );
}
