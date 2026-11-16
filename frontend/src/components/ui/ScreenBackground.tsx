import { LinearGradient } from 'expo-linear-gradient';
import { useState, type ReactNode } from 'react';
import {
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { shade } from '@/ui/glass/glassColors';

import { useGlass } from './glassTokens';

interface ScreenBackgroundProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Colours instead of the theme: the result screens' mint or soft red (glows from the tile). */
  palette?: { tint: string; tile: string };
}

/**
 * Screen background: the theme tint → tile gradient (top to bottom) with three soft round glows
 * in theme colours at low alpha. No corner shapes, nothing with a hard edge.
 */
export function ScreenBackground({ children, style, palette }: ScreenBackgroundProps) {
  const saved = useGlass();
  const deep = palette ? shade(palette.tile, -0.35) : saved.primary;
  const c = palette
    ? { ...palette, primary: deep, primary2: deep, primaryText: shade(palette.tile, -0.5) }
    : saved;
  const win = useWindowDimensions();
  // The view's real size (on Android it also runs under the system buttons).
  const [size, setSize] = useState({ w: win.width, h: win.height });
  const { w, h } = size;
  const glows = [
    { id: 'glowTop', x: w * 0.9, y: h * 0.06, r: w * 0.75, color: c.primary2, alpha: 0.16 },
    { id: 'glowMid', x: w * 0.05, y: h * 0.55, r: w * 0.7, color: c.primary, alpha: 0.1 },
    { id: 'glowLow', x: w * 0.75, y: h * 0.95, r: w * 0.8, color: c.primaryText, alpha: 0.1 },
  ];
  return (
    <View
      style={[{ flex: 1, backgroundColor: c.tint }, style]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (Math.abs(width - w) > 1 || Math.abs(height - h) > 1) setSize({ w: width, h: height });
      }}
    >
      <LinearGradient colors={[c.tint, c.tile]} style={StyleSheet.absoluteFill} />
      <Svg pointerEvents="none" width={w} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          {glows.map((g) => (
            <RadialGradient
              key={g.id}
              id={g.id}
              cx={g.x}
              cy={g.y}
              r={g.r}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={g.color} stopOpacity={g.alpha} />
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
