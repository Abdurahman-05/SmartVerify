import { createContext, useContext, useState, type ReactNode } from 'react';
import {
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useBrandColors } from '@/store/theme';

import { glass } from './glassColors';

/**
 * true inside an area that already has one background (the tab screens): screens there draw none
 * of their own, so the background runs on unbroken under the floating nav.
 */
export const ScreenBgProvided = createContext(false);

interface ScreenBgProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Colors to use instead of the saved theme (the first-start theme picker previews its pick). */
  palette?: { tint: string; tile: string };
}

/**
 * Light glass screen background, as in the design's `.scr`: the theme tint with three soft radial
 * glows (tile color top-left, amber on the right edge, tile color bottom-left).
 */
export function ScreenBg({ children, style, palette }: ScreenBgProps) {
  const provided = useContext(ScreenBgProvided);
  const saved = useBrandColors();
  const brand = palette ?? saved;
  const win = useWindowDimensions();
  // The real size of this view: on Android it is taller than the "window" (it also runs under
  // the system buttons), and the glows must reach its true bottom edge.
  const [size, setSize] = useState({ w: win.width, h: win.height });
  const { w, h } = size;
  // CSS "circle at x y" reaches the farthest corner; each glow fades out at its own percent.
  const far = (x: number, y: number) => Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
  const glows = [
    { id: 'a', x: w * 0.06, y: h * 0.04, reach: 0.46, color: brand.tile },
    { id: 'b', x: w, y: h * 0.34, reach: 0.36, color: glass.amberBlob },
    { id: 'c', x: w * 0.22, y: h, reach: 0.5, color: brand.tile },
  ];
  if (provided && !palette) return <View style={[styles.root, style]}>{children}</View>;
  return (
    <View
      style={[styles.root, { backgroundColor: brand.tint }, style]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (Math.abs(width - w) > 1 || Math.abs(height - h) > 1) setSize({ w: width, h: height });
      }}
    >
      <Svg pointerEvents="none" width={w} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          {glows.map((g) => (
            <RadialGradient
              key={g.id}
              id={g.id}
              cx={g.x}
              cy={g.y}
              r={far(g.x, g.y) * g.reach}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={g.color} stopOpacity={1} />
              <Stop offset="1" stopColor={g.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {glows.map((g) => (
          <Rect key={g.id} x={0} y={0} width={w} height={h} fill={`url(#${g.id})`} />
        ))}
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
