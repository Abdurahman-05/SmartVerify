import type { ReactNode } from 'react';
import { Image, useWindowDimensions, View } from 'react-native';

// Corner pictures of the Sign in / Sign up background, sized on a 720 px wide design.
const topLeft = require('../../../assets/images/auth/corner-top-left.png') as number;
const topRight = require('../../../assets/images/auth/corner-top-right.png') as number;
const bottomLeft = require('../../../assets/images/auth/corner-bottom-left.png') as number;
const bottomRight = require('../../../assets/images/auth/corner-bottom-right.png') as number;

const DESIGN_WIDTH = 720;

/** White auth background with food corner pictures; children render on top. */
export function AuthBackground({ children }: { children?: ReactNode }) {
  const s = useWindowDimensions().width / DESIGN_WIDTH;
  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <Image
        source={topLeft}
        pointerEvents="none"
        resizeMode="contain"
        style={{ position: 'absolute', top: 0, left: 0, width: 290 * s, height: 240 * s }}
      />
      <Image
        source={topRight}
        pointerEvents="none"
        resizeMode="contain"
        style={{ position: 'absolute', top: 0, right: 0, width: 350 * s, height: 460 * s }}
      />
      <Image
        source={bottomLeft}
        pointerEvents="none"
        resizeMode="contain"
        style={{ position: 'absolute', bottom: 0, left: 0, width: 430 * s, height: 350 * s }}
      />
      <Image
        source={bottomRight}
        pointerEvents="none"
        resizeMode="contain"
        style={{ position: 'absolute', bottom: 0, right: 0, width: 280 * s, height: 350 * s }}
      />
      {children}
    </View>
  );
}
