import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useGlass } from './glassTokens';
import { LogoLoader } from './LogoLoader';
import { Text } from './Text';

// Colours follow the chosen theme (orange by default).
const TEXT = '#1E1A1C';
const SUB = '#5E5559';
const LOGO_WIDTH = 180;

/** One 12 px dot bouncing up 12 px every 1 s; each starts 150 ms after the one before. */
function Dot({ index, still, color }: { index: number; still: boolean; color: string }) {
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
      style={[{ width: 12, height: 12, borderRadius: 6, backgroundColor: color }, style]}
    />
  );
}

/**
 * The starter loader (app start): the logo drawing itself on (same loader as every loading page),
 * a title whose last word is orange, a short line and three bouncing dots. Reduce motion = still.
 */
export function StarterLoader({ title, subtitle }: { title: string; subtitle: string }) {
  const still = useReducedMotion();
  const g = useGlass();
  const dots = [g.primaryDeep, g.primary, g.primary2];
  const words = title.split(' ');
  const head = words.length > 1 ? `${words.slice(0, -1).join(' ')} ` : '';
  return (
    <View
      style={{ alignItems: 'center', gap: 26 }}
      accessibilityRole="progressbar"
      accessibilityLabel={title}
    >
      <LogoLoader size={LOGO_WIDTH} />
      <View style={{ alignItems: 'center', gap: 4, paddingHorizontal: 24 }}>
        <Text font="heading" className="text-center text-[22px]" style={{ color: TEXT }}>
          {head}
          <Text font="heading" className="text-[22px]" style={{ color: g.primaryDeep }}>
            {words[words.length - 1]}
          </Text>
        </Text>
        <Text className="text-center text-[15px]" style={{ color: SUB }}>
          {subtitle}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, height: 26 }}>
        {dots.map((color, i) => (
          <Dot key={i} index={i} still={still} color={color} />
        ))}
      </View>
    </View>
  );
}
