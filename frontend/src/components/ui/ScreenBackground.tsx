import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { alpha, useGlass } from './glassTokens';

const YELLOW = '#FACC15';
const PINK = '#F43F5E';

/** Soft round glow: the colour fades to nothing at the edge. */
function Glow({
  id,
  x,
  y,
  r,
  color,
  a,
}: {
  id: string;
  x: string;
  y: string;
  r: number;
  color: string;
  a: number;
}) {
  return (
    <>
      <Defs>
        <RadialGradient id={id}>
          <Stop offset="0" stopColor={color} stopOpacity={a} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={x} cy={y} r={r} fill={`url(#${id})`} />
    </>
  );
}

/** Screen background: tint → tile gradient with theme blobs and soft glows behind the content. */
export function ScreenBackground({ children }: { children?: ReactNode }) {
  const g = useGlass();
  return (
    <View style={{ flex: 1, backgroundColor: g.tint }}>
      <LinearGradient colors={[g.tint, g.tile]} style={StyleSheet.absoluteFill} />
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Glow id="glowMain" x="88%" y="46%" r={150} color={g.primary2} a={0.55} />
        <Glow id="glowYellow" x="10%" y="66%" r={140} color={YELLOW} a={0.5} />
        <Glow id="glowPink" x="70%" y="88%" r={150} color={PINK} a={0.28} />
        <Circle cx="108%" cy="-4%" r={150} fill={alpha(g.tile, 0.9)} />
        <Circle cx="108%" cy="-4%" r={92} fill={g.primary2} />
        <Circle cx="-12%" cy="104%" r={170} fill={alpha(g.tile, 0.9)} />
        <Circle cx="-12%" cy="104%" r={110} fill={g.primary2} />
      </Svg>
      {children}
    </View>
  );
}
