import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useBrandColors } from '@/store/theme';

import { Text } from './Text';

/** Everything is drawn on a 240 × 240 design box, scaled to the screen. */
const BOX = 240;
const RING_STROKE = 7;
const RING_R = (BOX - RING_STROKE) / 2;
const RING_LENGTH = 2 * Math.PI * RING_R;

type FoodType = 'broccoli' | 'carrot' | 'beef' | 'mushroom';

/** Each falls for FALL_MS, then rests; spread so one is always in the air. */
const FALL_MS = 1100;
const CYCLE_MS = 2200;
const FOODS: { type: FoodType; left: number; delay: number }[] = [
  { type: 'broccoli', left: 62, delay: 0 },
  { type: 'carrot', left: 118, delay: CYCLE_MS / 4 },
  { type: 'beef', left: 150, delay: CYCLE_MS / 2 },
  { type: 'mushroom', left: 90, delay: (CYCLE_MS * 3) / 4 },
];
const STEAM_LEFT = [96, 122, 148];

function Ingredient({ type }: { type: FoodType }) {
  if (type === 'broccoli') {
    return (
      <Svg width={30} height={30} viewBox="0 0 40 40">
        <Rect x="17" y="24" width="7" height="13" rx="2" fill="#79B65A" />
        <Circle cx="13" cy="20" r="9" fill="#168444" />
        <Circle cx="21" cy="12" r="10" fill="#2DAD59" />
        <Circle cx="29" cy="20" r="9" fill="#168444" />
        <Circle cx="21" cy="22" r="9" fill="#32A653" />
      </Svg>
    );
  }
  if (type === 'carrot') {
    return (
      <Svg width={30} height={30} viewBox="0 0 40 40">
        <Path d="M12 10 Q22 5 30 13 L17 36 Q13 39 12 31 L7 17 Q6 12 12 10Z" fill="#F28C28" />
        <Path d="M12 17 L18 19 M15 24 L19 26" stroke="#D96B16" strokeWidth="2" />
        <Path
          d="M12 11 Q5 4 10 3 M14 10 Q15 1 21 4"
          stroke="#29944D"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
    );
  }
  if (type === 'beef') {
    return (
      <Svg width={30} height={30} viewBox="0 0 40 40">
        <Path d="M8 13 L25 7 L34 16 L30 32 L14 36 L6 25Z" fill="#A84E3B" />
        <Path d="M8 13 L25 7 L34 16 L19 22Z" fill="#D47B60" />
        <Path d="M19 22 L34 16 L30 32 L14 36Z" fill="#974332" />
      </Svg>
    );
  }
  return (
    <Svg width={30} height={30} viewBox="0 0 40 40">
      <Path d="M15 22 L14 34 Q20 37 26 34 L25 22Z" fill="#E9D8B8" />
      <Path d="M4 23 Q5 7 20 7 Q35 7 36 23 Q20 29 4 23Z" fill="#A87953" />
      <Path d="M10 19 Q16 12 22 13" stroke="#D9B58E" strokeWidth="2" fill="none" />
    </Svg>
  );
}

function FoodBowl({ color }: { color: string }) {
  return (
    <Svg width={154} height={100} viewBox="0 0 154 100">
      <Ellipse cx="77" cy="88" rx="43" ry="5" fill="#B6D8C8" opacity={0.5} />
      <Path d="M15 29 Q20 83 77 84 Q134 83 139 29 Q77 42 15 29Z" fill={color} />
      <Path d="M23 42 Q35 76 77 77 Q119 76 131 42" stroke="#167457" strokeWidth="2" fill="none" />
      <Ellipse cx="77" cy="29" rx="62" ry="9" fill="#063F31" />
      {/* Noodles on top of the opening. */}
      <G stroke="#F5B923" strokeWidth="2.7" strokeLinecap="round" fill="none">
        <Path d="M32 30 Q44 20 55 29 T79 28 T103 29 T120 26" />
        <Path d="M37 28 Q51 34 63 26 T86 26 T110 30" />
        <Path d="M47 26 Q62 19 74 27 T99 27" />
      </G>
      <Path d="M17 29 Q77 46 137 29" stroke="#2BA47A" strokeWidth="2" fill="none" />
    </Svg>
  );
}

/** One looping 0 → 1 value; held at `rest` when motion is reduced. Stops on unmount. */
function useLoop(
  build: (value: SharedValue<number>) => number,
  animate: boolean,
  rest = 0
): SharedValue<number> {
  const value = useSharedValue(rest);
  useEffect(() => {
    if (!animate) {
      value.value = rest;
      return;
    }
    value.value = build(value);
    return () => cancelAnimation(value);
    // The animation is built once per animate change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate]);
  return value;
}

function FallingFood({
  type,
  left,
  delay,
  animate,
}: {
  type: FoodType;
  left: number;
  delay: number;
  animate: boolean;
}) {
  const fall = useLoop(
    () =>
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: FALL_MS, easing: Easing.in(Easing.quad) }),
            withTiming(1, { duration: CYCLE_MS - FALL_MS }),
            withTiming(0, { duration: 0 })
          ),
          -1
        )
      ),
    animate
  );
  const style = useAnimatedStyle(() => ({
    // Visible only while falling; lands just under the noodles.
    opacity: fall.value >= 1 ? 0 : interpolate(fall.value, [0, 0.12, 0.85, 1], [0, 1, 1, 0]),
    transform: [
      { translateY: interpolate(fall.value, [0, 1], [0, 72]) },
      { rotate: `${interpolate(fall.value, [0, 1], [-25, 40])}deg` },
    ],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      className="absolute"
      style={[{ top: 44, left, zIndex: 4 }, style]}
    >
      <Ingredient type={type} />
    </Animated.View>
  );
}

function Steam({ left, delay, animate }: { left: number; delay: number; animate: boolean }) {
  const rise = useLoop(
    () =>
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 0 }),
            withTiming(0, { duration: 300 })
          ),
          -1
        )
      ),
    animate
  );
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(rise.value, [0, 0.3, 1], [0, 0.9, 0]),
    transform: [{ translateY: interpolate(rise.value, [0, 1], [10, -24]) }],
  }));
  return (
    <Animated.View pointerEvents="none" className="absolute" style={[{ top: 66, left }, style]}>
      <Svg width={22} height={40} viewBox="0 0 25 45">
        <Path
          d="M12 42 Q2 31 12 22 Q23 12 12 2"
          stroke="#9DCBB4"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}

function Dot({ delay, animate, color }: { delay: number; animate: boolean; color: string }) {
  const pulse = useLoop(
    () =>
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 320, easing: Easing.inOut(Easing.ease) }),
            withTiming(0, { duration: 320, easing: Easing.inOut(Easing.ease) }),
            withTiming(0, { duration: 480 })
          ),
          -1
        )
      ),
    animate,
    1
  );
  const style = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.65,
    transform: [{ scale: 0.8 + pulse.value * 0.4 }],
  }));
  return (
    <Animated.View
      className="h-2.5 w-2.5 rounded-full"
      style={[{ backgroundColor: color }, style]}
    />
  );
}

interface FoodLoadingAnimationProps {
  title?: string;
  subtitle?: string;
  /** Defaults to the theme background. */
  backgroundColor?: string;
}

/**
 * Restaurant loading: ingredients fall into a bowl of noodles inside a turning ring, steam rises.
 * Light (SVG + Reanimated on the UI thread), still when the phone asks for reduced motion.
 */
export function FoodLoadingAnimation({
  title,
  subtitle,
  backgroundColor,
}: FoodLoadingAnimationProps) {
  const { t } = useTranslation();
  const brand = useBrandColors();
  const animate = !useReducedMotion();
  const { width } = useWindowDimensions();
  // Up to 240 wide, smaller on narrow phones.
  const scale = Math.min(1, (width * 0.68) / BOX);

  const spin = useLoop(
    () => withRepeat(withTiming(1, { duration: 1600, easing: Easing.linear }), -1),
    animate
  );
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  // The bowl dips each time an ingredient lands (one every CYCLE_MS / 4, the first at FALL_MS).
  const LANDING_MS = CYCLE_MS / FOODS.length;
  const bounce = useLoop(
    () =>
      withDelay(
        FALL_MS - 130,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 130, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 260, easing: Easing.out(Easing.back(2)) }),
            withTiming(0, { duration: LANDING_MS - 390 })
          ),
          -1
        )
      ),
    animate
  );
  const bowlStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bounce.value * 3 }, { scaleY: 1 - bounce.value * 0.05 }],
  }));

  const label = title ?? t('loading.foodTitle');
  return (
    <View
      className={`flex-1 items-center justify-center ${backgroundColor ? '' : 'bg-background'}`}
      style={backgroundColor ? { backgroundColor } : undefined}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    >
      <View
        style={{ width: BOX * scale, height: BOX * scale }}
        className="mb-5 items-center justify-center"
        importantForAccessibility="no-hide-descendants"
      >
        <View style={{ width: BOX, height: BOX, transform: [{ scale }] }}>
          {/* Plate behind the bowl. */}
          <View
            className="absolute rounded-full border-[7px] border-border bg-primarySoft"
            style={{ left: 25, top: 25, width: 190, height: 190 }}
          />
          {/* Ring: a light track and a turning arc (a third of the circle). */}
          <Svg width={BOX} height={BOX} style={{ position: 'absolute' }}>
            <Circle
              cx={BOX / 2}
              cy={BOX / 2}
              r={RING_R}
              stroke={brand.primary}
              strokeOpacity={0.12}
              strokeWidth={RING_STROKE}
              fill="none"
            />
          </Svg>
          <Animated.View style={[{ position: 'absolute', width: BOX, height: BOX }, ringStyle]}>
            <Svg width={BOX} height={BOX}>
              <Circle
                cx={BOX / 2}
                cy={BOX / 2}
                r={RING_R}
                stroke={brand.primary}
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={`${RING_LENGTH / 3} ${RING_LENGTH}`}
                fill="none"
              />
            </Svg>
          </Animated.View>

          {STEAM_LEFT.map((left, i) => (
            <Steam key={left} left={left} delay={i * 550} animate={animate} />
          ))}
          <Animated.View className="absolute" style={[{ top: 92, left: 43, zIndex: 3 }, bowlStyle]}>
            <FoodBowl color={brand.primary} />
          </Animated.View>
          {FOODS.map((food) => (
            <FallingFood key={food.type} {...food} animate={animate} />
          ))}
        </View>
      </View>

      <View className="items-center px-6">
        <Text font="heading" className="text-center text-[24px]">
          {label}
        </Text>
        <Text tone="muted" className="mt-1.5 text-center text-base">
          {subtitle ?? t('loading.foodSubtitle')}
        </Text>
      </View>
      <View className="mt-4 flex-row gap-2.5">
        {[0, 180, 360].map((delay) => (
          <Dot key={delay} delay={delay} animate={animate} color={brand.primary} />
        ))}
      </View>
    </View>
  );
}
