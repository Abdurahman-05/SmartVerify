import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { useBrandColors } from '@/store/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { colors } from '@/theme/tokens';

function useRotation(enabled: boolean) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (!enabled) {
      cancelAnimation(rotation);
      return;
    }
    rotation.value = withRepeat(withTiming(360, { duration: 1100, easing: Easing.linear }), -1);
    return () => cancelAnimation(rotation);
  }, [enabled, rotation]);

  return useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
}

interface SpinnerRingProps {
  size: number;
  children: ReactNode;
}

/** Large spinning ring with a soft pulse behind it, from the loading designs. */
export function SpinnerRing({ size, children }: SpinnerRingProps) {
  const brand = useBrandColors();
  const reducedMotion = useReducedMotion();
  const ringStyle = useRotation(!reducedMotion);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(pulse);
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 600 }),
        withTiming(0, { duration: 0 })
      ),
      -1
    );
    return () => cancelAnimation(pulse);
  }, [reducedMotion, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion ? 0.55 : 0.55 * (1 - pulse.value),
    transform: [{ scale: reducedMotion ? 1 : 0.9 + pulse.value * 0.35 }],
  }));

  return (
    <View className="items-center justify-center" style={{ width: size, height: size }}>
      <Animated.View
        className="absolute rounded-full bg-primaryTile"
        style={[{ top: 22, left: 22, right: 22, bottom: 22 }, pulseStyle]}
      />
      <Animated.View className="absolute inset-0" style={ringStyle}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Circle cx={50} cy={50} r={46} fill="none" stroke={colors.border} strokeWidth={4} />
          <Path
            d="M50 4a46 46 0 0 1 46 46"
            fill="none"
            stroke={brand.primary}
            strokeWidth={4}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>
      {children}
    </View>
  );
}

export function SmallSpinner({ size = 36 }: { size?: number }) {
  const brand = useBrandColors();
  const reducedMotion = useReducedMotion();
  const style = useRotation(!reducedMotion);

  return (
    <Animated.View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 36 36">
        <Circle cx={18} cy={18} r={15} fill="none" stroke={colors.border} strokeWidth={4} />
        <Path
          d="M18 3a15 15 0 0 1 15 15"
          fill="none"
          stroke={brand.primary}
          strokeWidth={4}
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}
