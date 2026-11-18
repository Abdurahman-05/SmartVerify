import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, G, Mask, Path } from 'react-native-svg';

import {
  LOGO_ASPECT,
  LOGO_CHECK,
  LOGO_G,
  LOGO_LINES,
  LOGO_VIEWBOX,
  REVEAL_CHECK,
  REVEAL_CHECK_LENGTH,
  REVEAL_CHECK_WIDTH,
  REVEAL_G,
  REVEAL_G_LENGTH,
  REVEAL_G_WIDTH,
} from '../../../assets/logo/gebtual-logo-kit/gebtual-logo-kit/gebtual-logo';
import { GebtualLogo } from './GebtualLogo';
import { useGlass } from './glassTokens';
import { Text } from './Text';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

const DURATION = 3000;
const SLIDE = 26;
const ease = Easing.inOut(Easing.ease);

/** Progress 0..1 of a phase that runs from `from` to `to` (fractions of the loop). */
const phase = (p: number, from: number, to: number) => {
  'worklet';
  return interpolate(p, [from, to], [0, 1], 'clamp');
};

/**
 * Only the logo, drawn on in a 3 s loop: the ገ, then the check, then the speed lines slide in,
 * hold, fade out, repeat. With reduce motion on, the finished logo is shown still.
 */
export function LogoLoader({ size = 150, label }: { size?: number; label?: string }) {
  const g = useGlass();
  const still = useReducedMotion();
  const p = useSharedValue(0);

  useEffect(() => {
    if (still) return;
    p.value = 0;
    p.value = withRepeat(withTiming(1, { duration: DURATION, easing: Easing.linear }), -1);
    return () => cancelAnimation(p);
  }, [still, p]);

  const gProps = useAnimatedProps(() => ({
    strokeDashoffset: REVEAL_G_LENGTH * (1 - ease(phase(p.value, 0, 0.4))),
  }));
  const checkProps = useAnimatedProps(() => ({
    strokeDashoffset: REVEAL_CHECK_LENGTH * (1 - ease(phase(p.value, 0.38, 0.56))),
  }));
  const linesProps = useAnimatedProps(() => {
    const t = phase(p.value, 0.56, 0.68);
    return { opacity: t, translateX: -SLIDE * (1 - t) };
  });
  const fade = useAnimatedStyle(() => ({ opacity: 1 - phase(p.value, 0.86, 0.96) }));

  const text = label && (
    <Text font="bold" className="text-sm" style={{ color: '#4A4246', marginTop: 16 }}>
      {label}
    </Text>
  );

  if (still) {
    return (
      <View style={{ alignItems: 'center' }}>
        <GebtualLogo width={size} />
        {text}
      </View>
    );
  }

  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View style={fade}>
        <Svg width={size} height={size / LOGO_ASPECT} viewBox={LOGO_VIEWBOX}>
          <Defs>
            <Mask id="revealG" maskUnits="userSpaceOnUse" x="0" y="0" width="930" height="505">
              <AnimatedPath
                d={REVEAL_G}
                stroke="#FFFFFF"
                strokeWidth={REVEAL_G_WIDTH}
                fill="none"
                strokeDasharray={[REVEAL_G_LENGTH, REVEAL_G_LENGTH]}
                animatedProps={gProps}
              />
            </Mask>
            <Mask id="revealCheck" maskUnits="userSpaceOnUse" x="0" y="0" width="930" height="505">
              <AnimatedPath
                d={REVEAL_CHECK}
                stroke="#FFFFFF"
                strokeWidth={REVEAL_CHECK_WIDTH}
                fill="none"
                strokeDasharray={[REVEAL_CHECK_LENGTH, REVEAL_CHECK_LENGTH]}
                animatedProps={checkProps}
              />
            </Mask>
          </Defs>
          <Path d={LOGO_G} fill={g.primaryDeep} fillRule="evenodd" mask="url(#revealG)" />
          <Path d={LOGO_CHECK} fill={g.primary2} mask="url(#revealCheck)" />
          <AnimatedG animatedProps={linesProps}>
            <Path d={LOGO_LINES} fill={g.primaryDeep} />
          </AnimatedG>
        </Svg>
      </Animated.View>
      {text}
    </View>
  );
}
