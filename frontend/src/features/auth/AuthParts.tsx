import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Lock } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/components/ui/Text';
import { useBrandColors } from '@/store/theme';
import { shade } from '@/ui/glass';

// Sign in / Sign up design (assets/images/auth/reference-signin.png). Text colours are fixed.
export const AUTH = {
  text: '#1E1A1C',
  soft: '#4A4246',
};

/** The chosen theme's colours for the auth screens (orange by default). */
export function useAuthColors() {
  const brand = useBrandColors();
  return {
    // The start pages use the deep theme colour for every accent.
    p: brand.primaryDeep,
    p2: shade(brand.primary, 0.16),
    pt: brand.primaryDeep,
    deep: brand.primaryDeep,
  };
}

const glyph = require('../../../assets/images/auth/logo-glyph.png') as number;

/** 84 px theme gradient tile with the ገ glyph (the glyph image includes the ✓ badge). */
export function AuthLogo() {
  const c = useAuthColors();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.logoShadow,
        { boxShadow: `inset 0 2px 0 rgba(255,255,255,0.35), 0 14px 28px ${c.p}52` },
      ]}
    >
      <View style={[styles.logo, { backgroundColor: c.deep }]}>
        <Image source={glyph} style={{ width: 70, height: 70 }} contentFit="contain" />
      </View>
    </View>
  );
}

/** Sora 28 title on a frosted pill; the last word in the theme colour, or in `accent`. */
export function AuthTitle({ text, accent }: { text: string; accent?: string }) {
  const c = useAuthColors();
  const words = text.split(' ');
  const head = words.length > 1 ? `${words.slice(0, -1).join(' ')} ` : '';
  return (
    <View style={[styles.pill, { marginTop: 14, borderRadius: 16, paddingHorizontal: 14 }]}>
      <Text
        font="heading"
        className="text-center text-[28px] leading-8"
        style={{ color: AUTH.text }}
        accessibilityRole="header"
      >
        {head}
        <Text font="heading" className="text-[28px]" style={{ color: accent ?? c.p }}>
          {words[words.length - 1]}
        </Text>
      </Text>
    </View>
  );
}

/** 16 px subtitle on a frosted pill. */
export function AuthSubtitle({ text }: { text: string }) {
  return (
    <View style={[styles.pill, { marginTop: 4, borderRadius: 12, paddingHorizontal: 12 }]}>
      <Text className="text-center text-base" style={{ color: AUTH.soft }}>
        {text}
      </Text>
    </View>
  );
}

/** Frosted white card: radius 26, padding 16, gap 10, blurred picture behind. */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <View style={styles.card}>
      <BlurView intensity={30} tint="light" style={[StyleSheet.absoluteFill, styles.cardClip]} />
      {children}
    </View>
  );
}

/** Lock + "SECURE PAYMENT VERIFICATION", 13 bold. */
export function SecureLine({ text, style }: { text: string; style?: ViewStyle }) {
  return (
    <View className="flex-row items-center gap-1.5" style={style}>
      <Lock size={15} color={AUTH.soft} strokeWidth={2.6} />
      <Text font="bold" className="text-[13px] tracking-[0.65px]" style={{ color: AUTH.soft }}>
        {text}
      </Text>
    </View>
  );
}

/** "Don't have an account? Sign up" on a white pill, then the secure line. */
export function AuthFooter({
  prefix,
  link,
  onPress,
  secure,
}: {
  prefix: string;
  link: string;
  onPress: () => void;
  secure: string;
}) {
  const c = useAuthColors();
  return (
    <View className="items-center">
      <Pressable
        onPress={onPress}
        accessibilityRole="link"
        className="mt-3.5 min-h-11 justify-center"
      >
        <View className="flex-row flex-wrap items-center justify-center rounded-[14px] bg-white/70 px-3 py-1">
          <Text className="text-base" style={{ color: AUTH.text }}>
            {prefix}{' '}
          </Text>
          <Text font="bold" className="text-base" style={{ color: c.pt }}>
            {link}
          </Text>
        </View>
      </Pressable>
      <SecureLine text={secure} style={{ marginTop: 6 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  logoShadow: { borderRadius: 26 },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: { backgroundColor: 'rgba(255,255,255,0.72)', paddingVertical: 2 },
  card: {
    width: '100%',
    marginTop: 18,
    padding: 16,
    gap: 10,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
    backgroundColor: 'rgba(255,255,255,0.6)',
    boxShadow: 'inset 0 1px 0 #FFFFFF, 0 14px 34px rgba(30,20,25,0.10)',
  },
  cardClip: { borderRadius: 26, overflow: 'hidden' },
});

/** Filled phone (design label icon). */
export function PhoneFilled({ size = 18, color }: { size?: number; color?: string }) {
  const c = useAuthColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color ?? c.p}>
      <Path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" />
    </Svg>
  );
}

/** Filled shield with a keyhole (design PIN label icon). */
export function ShieldFilled({ size = 18, color }: { size?: number; color?: string }) {
  const c = useAuthColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color ?? c.p}>
      <Path d="M12 2 4 5v6c0 5.2 3.4 9.4 8 11 4.6-1.6 8-5.8 8-11V5zm0 6a2 2 0 0 1 1 3.73V15h-2v-3.27A2 2 0 0 1 12 8z" />
    </Svg>
  );
}
