import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Text } from './Text';

// The ገ with its ✓ badge (the image includes the badge).
const glyph = require('../../../assets/images/auth/logo-glyph.png') as number;

// Brand orange of the starter screen (same in every theme, like the app icon).
const P = '#EA580C';
const P2 = '#F97316';
const PT = '#C2410C';
const AMBER = '#F59E0B';
const TEXT = '#1E1A1C';
const SUB = '#5E5559';
const DOT_COLORS = [P, P2, AMBER];
const LOGO = 112;
const RING_INSET = 14;

/** Logo circle that pulses 1 → 1.05 → 1 every 1.6 s, with a spinning ring around it. */
function LogoLoader({ still }: { still: boolean }) {
  const scale = useSharedValue(1);
  const turn = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    scale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1
    );
    turn.value = withRepeat(withTiming(360, { duration: 1100, easing: Easing.linear }), -1);
  }, [still, scale, turn]);
  const pulse = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  const ring = LOGO + RING_INSET * 2;
  return (
    <View style={{ width: LOGO, height: LOGO, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: -RING_INSET,
            left: -RING_INSET,
            width: ring,
            height: ring,
            borderRadius: ring / 2,
            borderWidth: 5,
            borderColor: 'rgba(234,88,12,0.15)',
            borderTopColor: P,
            borderRightColor: AMBER,
          },
          spin,
        ]}
      />
      <Animated.View style={pulse}>
        <LinearGradient
          colors={[P2, P, PT]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{
            width: LOGO,
            height: LOGO,
            borderRadius: LOGO / 2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image source={glyph} style={{ width: 82, height: 82 }} contentFit="contain" />
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

/** One 12 px dot bouncing up 12 px every 1 s; each starts 150 ms after the one before. */
function Dot({ index, still }: { index: number; still: boolean }) {
  const y = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    y.value = withDelay(
      index * 150,
      withRepeat(
        withSequence(withTiming(-12, { duration: 500 }), withTiming(0, { duration: 500 })),
        -1
      )
    );
  }, [index, still, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View
      style={[
        { width: 12, height: 12, borderRadius: 6, backgroundColor: DOT_COLORS[index] },
        style,
      ]}
    />
  );
}

/**
 * The starter loader (app start and every loading page): pulsing logo with a spinning ring,
 * a title whose last word is orange, a short line and three bouncing dots. Reduce motion = still.
 */
export function StarterLoader({ title, subtitle }: { title: string; subtitle: string }) {
  const still = useReducedMotion();
  const words = title.split(' ');
  const head = words.length > 1 ? `${words.slice(0, -1).join(' ')} ` : '';
  return (
    <View
      style={{ alignItems: 'center', gap: 26 }}
      accessibilityRole="progressbar"
      accessibilityLabel={title}
    >
      <LogoLoader still={still} />
      <View style={{ alignItems: 'center', gap: 4, paddingHorizontal: 24 }}>
        <Text font="heading" className="text-center text-[22px]" style={{ color: TEXT }}>
          {head}
          <Text font="heading" className="text-[22px]" style={{ color: P }}>
            {words[words.length - 1]}
          </Text>
        </Text>
        <Text className="text-center text-[15px]" style={{ color: SUB }}>
          {subtitle}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, height: 26 }}>
        {DOT_COLORS.map((color, i) => (
          <Dot key={color} index={i} still={still} />
        ))}
      </View>
    </View>
  );
}
