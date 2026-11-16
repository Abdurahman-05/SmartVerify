import type { ReactNode } from 'react';
import { Image, useWindowDimensions } from 'react-native';

import { ScreenBackground } from './ScreenBackground';

// Food pictures in three corners of the Sign in / Sign up / splash background (no curl shapes),
// sized on a 720 px wide design.
const topRight = require('../../../assets/images/auth/corner-top-right.png') as number;
const bottomLeft = require('../../../assets/images/auth/corner-bottom-left.png') as number;
const bottomRight = require('../../../assets/images/auth/corner-bottom-right.png') as number;

const DESIGN_WIDTH = 720;

/**
 * Auth background: the same theme tint → tile gradient and soft glows as every screen, with the
 * pizza, chicken and shake pictures (transparent PNGs) on top; children render above them.
 */
export function AuthBackground({ children }: { children?: ReactNode }) {
  const s = useWindowDimensions().width / DESIGN_WIDTH;
  return (
    <ScreenBackground>
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
    </ScreenBackground>
  );
}
