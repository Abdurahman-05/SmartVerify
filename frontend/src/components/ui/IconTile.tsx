import type { ComponentType } from 'react';
import { View } from 'react-native';

import { colors } from '@/theme/tokens';

import { useGlass } from './glassTokens';

type Icon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const semantic = {
  green: { bg: colors.successBg, fg: colors.successFg },
  red: { bg: colors.dangerBg, fg: colors.dangerFg },
  amber: { bg: colors.warnBg, fg: colors.warnFg },
} as const;

export interface IconTileProps {
  icon: Icon;
  /** brand = theme gradient with a white icon; the others are soft status colours. */
  tone?: 'brand' | keyof typeof semantic;
  size?: number;
  radius?: number;
  iconSize?: number;
}

/** Rounded square holding one icon. */
export function IconTile({
  icon: Glyph,
  tone = 'brand',
  size = 42,
  radius = 14,
  iconSize,
}: IconTileProps) {
  const g = useGlass();
  const box = {
    width: size,
    height: size,
    borderRadius: radius,
    alignItems: 'center',
    justifyContent: 'center',
  } as const;
  const glyphSize = iconSize ?? Math.round(size / 2);
  if (tone === 'brand') {
    return (
      <View style={[box, { backgroundColor: g.primaryDeep }]}>
        <Glyph size={glyphSize} color="#FFFFFF" strokeWidth={2.2} />
      </View>
    );
  }
  return (
    <View style={[box, { backgroundColor: semantic[tone].bg }]}>
      <Glyph size={glyphSize} color={semantic[tone].fg} strokeWidth={2.2} />
    </View>
  );
}
