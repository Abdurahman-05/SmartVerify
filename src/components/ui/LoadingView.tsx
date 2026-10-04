import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { colors } from '@/theme/tokens';

import { SecureFooter } from './SecureFooter';
import { SpinnerRing } from './Spinner';
import { Text } from './Text';

interface LoadingViewProps {
  title?: string;
  subtitle?: string;
}

function LoadingDot({ delay, animate }: { delay: number; animate: boolean }) {
  const progress = useSharedValue(animate ? 0 : 1);

  useEffect(() => {
    if (!animate) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 480, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 480, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 240 })
        ),
        -1
      )
    );
    return () => cancelAnimation(progress);
  }, [animate, delay, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.25 + progress.value * 0.75,
    transform: [{ scale: 0.8 + progress.value * 0.2 }],
  }));

  return <Animated.View className="h-3 w-3 rounded-full bg-primary" style={style} />;
}

export function LoadingView({ title, subtitle }: LoadingViewProps) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();

  return (
    <SafeAreaView
      className="flex-1 bg-background"
      accessibilityRole="progressbar"
      accessibilityLabel={title ?? t('loading.title')}
    >
      <View className="flex-1 items-center justify-center gap-7">
        <SpinnerRing size={190}>
          <View className="h-[92px] w-[92px] items-center justify-center rounded-[28px] bg-primary">
            <Svg
              width={54}
              height={54}
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.surface}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
              <Path d="M8.5 12l2.5 2.5 4.5-5" />
            </Svg>
          </View>
        </SpinnerRing>

        <View className="items-center px-6">
          <Text font="heading" className="text-center text-[26px]">
            {title ?? t('loading.title')}
          </Text>
          <Text tone="muted" className="mt-1.5 text-center text-lg">
            {subtitle ?? t('loading.subtitle')}
          </Text>
        </View>

        <View className="flex-row gap-2">
          {[0, 200, 400].map((delay) => (
            <LoadingDot key={delay} delay={delay} animate={!reducedMotion} />
          ))}
        </View>
      </View>

      <View className="pb-9">
        <SecureFooter />
      </View>
    </SafeAreaView>
  );
}
