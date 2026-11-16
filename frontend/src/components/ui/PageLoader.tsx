import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useGlass } from './glassTokens';
import { Text } from './Text';

// The ገ with its ✓ badge (the image includes the badge).
const glyph = require('../../../assets/images/auth/logo-glyph.png') as number;

const LOGO = 88;
const RING_INSET = 12;
const RING = LOGO + RING_INSET * 2;

/**
 * Loading over the current screen: a blurred, lightly tinted veil with the pulsing logo and a
 * spinning ring in the theme colours, and "Loading…". With reduce motion on, the ring turns
 * slowly and the logo stays still. Renders nothing while `visible` is false.
 */
export function PageLoader({ visible, label }: { visible: boolean; label?: string }) {
  const { t } = useTranslation();
  const g = useGlass();
  const still = useReducedMotion();
  const scale = useSharedValue(1);
  const turn = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    turn.value = 0;
    turn.value = withRepeat(
      withTiming(360, { duration: still ? 3600 : 900, easing: Easing.linear }),
      -1
    );
    if (!still) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      );
    }
    return () => {
      cancelAnimation(turn);
      cancelAnimation(scale);
      scale.value = 1;
    };
  }, [visible, still, scale, turn]);

  const pulse = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));

  if (!visible) return null;
  const text = label ?? t('loading.label');
  return (
    <View
      style={StyleSheet.absoluteFill}
      accessibilityRole="progressbar"
      accessibilityLabel={text}
      accessibilityViewIsModal
    >
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,248,242,0.45)' }]} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22 }}>
        <View style={{ width: LOGO, height: LOGO, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: -RING_INSET,
                left: -RING_INSET,
                width: RING,
                height: RING,
                borderRadius: RING / 2,
                borderWidth: 4,
                borderColor: 'rgba(255,255,255,0.7)',
                borderTopColor: g.primary,
                borderRightColor: g.primary2,
              },
              spin,
            ]}
          />
          <Animated.View style={pulse}>
            <View
              style={{
                width: LOGO,
                height: LOGO,
                borderRadius: LOGO / 2,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: g.primaryDeep,
              }}
            >
              <Image source={glyph} style={{ width: 64, height: 64 }} contentFit="contain" />
            </View>
          </Animated.View>
        </View>
        <View
          style={{
            backgroundColor: 'rgba(255,255,255,0.6)',
            borderRadius: 12,
            paddingVertical: 4,
            paddingHorizontal: 12,
          }}
        >
          <Text font="bold" className="text-sm" style={{ color: '#4A4246' }}>
            {text}
          </Text>
        </View>
      </View>
    </View>
  );
}
