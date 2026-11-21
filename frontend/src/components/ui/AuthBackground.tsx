import type { ReactNode } from 'react';
import { Image, View, useWindowDimensions } from 'react-native';
import { Coins, Receipt, ShoppingBag, CircleCheck } from 'lucide-react-native';

import { isNormalApp } from '@/lib/variant';

import { useGlass } from './glassTokens';
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
  return isNormalApp ? (
    <ShopAuthBackground>{children}</ShopAuthBackground>
  ) : (
    <FoodAuthBackground>{children}</FoodAuthBackground>
  );
}

/** Shop app: soft, neutral icons (bag, receipt, check, coin) instead of food pictures. */
function ShopAuthBackground({ children }: { children?: ReactNode }) {
  const s = useWindowDimensions().width / DESIGN_WIDTH;
  const g = useGlass();
  const icon = (Icon: typeof Coins, size: number, pos: object, rotate: string) => (
    <View
      pointerEvents="none"
      style={[{ position: 'absolute', opacity: 0.12, transform: [{ rotate }] }, pos]}
    >
      <Icon size={size * s} color={g.primary} strokeWidth={1.5} />
    </View>
  );
  return (
    <ScreenBackground>
      {icon(ShoppingBag, 230, { top: 20 * s, right: 10 * s }, '12deg')}
      {icon(Receipt, 220, { bottom: 30 * s, left: 10 * s }, '-10deg')}
      {icon(CircleCheck, 120, { bottom: 200 * s, right: 20 * s }, '0deg')}
      {icon(Coins, 130, { bottom: 20 * s, right: 150 * s }, '8deg')}
      {children}
    </ScreenBackground>
  );
}

function FoodAuthBackground({ children }: { children?: ReactNode }) {
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
