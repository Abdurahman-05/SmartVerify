import { useEffect, useState } from 'react';
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
import { isNormalApp } from '@/lib/variant';
import { colors } from '@/theme/tokens';

import { FoodLoadingAnimation } from './FoodLoadingAnimation';
import { ScreenHeader } from './ScreenHeader';
import { SecureFooter } from './SecureFooter';
import { SpinnerRing } from './Spinner';
import { Text } from './Text';

interface LoadingViewProps {
  title?: string;
  subtitle?: string;
  /** Header of the page being opened, shown on the slow-connection skeleton. */
  screenTitle?: string;
  onBack?: () => void;
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

/** A pulsing grey block for the slow-connection skeleton. */
function Bone({
  className,
  animate,
  width,
}: {
  className: string;
  animate: boolean;
  width?: number;
}) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!animate) return;
    pulse.value = withRepeat(
      withSequence(withTiming(0.45, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1
    );
    return () => cancelAnimation(pulse);
  }, [animate, pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View className={`bg-border ${className}`} style={[style, width ? { width } : null]} />
  );
}

/** Slow connection: the page's header over a skeleton list (LoadingList design). */
function SlowLoading({ screenTitle, onBack }: Pick<LoadingViewProps, 'screenTitle' | 'onBack'>) {
  const { t } = useTranslation();
  const animate = !useReducedMotion();
  return (
    <SafeAreaView
      className="flex-1 bg-background"
      accessibilityRole="progressbar"
      accessibilityLabel={t('loading.slow')}
    >
      <ScreenHeader title={screenTitle ?? ''} onBack={onBack} />
      <View className="mx-4 gap-2.5 rounded-[22px] bg-primary px-5 py-4">
        <View className="h-3.5 w-[55%] rounded-full bg-white/30" />
        <View className="h-[30px] w-[45%] rounded-lg bg-white/40" />
      </View>
      <View className="flex-row gap-2 overflow-hidden px-4 pb-2.5 pt-3.5">
        {[90, 70, 96, 84].map((width) => (
          <Bone key={width} animate={animate} width={width} className="h-12 rounded-full" />
        ))}
      </View>
      <View className="flex-1 gap-2 overflow-hidden px-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={i}
            className="flex-row items-center gap-3 rounded-[18px] border-[1.5px] border-border bg-surface p-3"
          >
            <Bone animate={animate} className="h-12 w-12 rounded-[14px]" />
            <View className="flex-1 gap-2">
              <Bone animate={animate} className="h-4 w-3/5 rounded-lg" />
              <Bone animate={animate} className="h-3 w-2/5 rounded-lg" />
            </View>
            <View className="items-end gap-2">
              <Bone animate={animate} className="h-[18px] w-20 rounded-lg" />
              <Bone animate={animate} className="h-3.5 w-16 rounded-xl" />
            </View>
          </View>
        ))}
      </View>
      <Text font="bold" tone="muted" className="pb-6 pt-2.5 text-center text-base">
        {t('loading.slow')}
      </Text>
    </SafeAreaView>
  );
}

/** After this long without data, assume a slow connection and show the page skeleton. */
const SLOW_MS = 2500;

export function LoadingView({ title, subtitle, screenTitle, onBack }: LoadingViewProps) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    // Only pages that pass their header switch; app start and actions stay branded.
    if (!screenTitle || title) return;
    const timer = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(timer);
  }, [screenTitle, title]);

  if (slow) return <SlowLoading screenTitle={screenTitle} onBack={onBack} />;
  return <BrandLoading title={title} subtitle={subtitle} />;
}

/**
 * The Restaurant app shows the food animation on its full loading page. Set to false to go back
 * to the shield for both apps.
 */
const FOOD_LOADING_IN_RESTAURANT_APP = true;

/** The full Smart Verify loading page. */
function BrandLoading({ title, subtitle }: Pick<LoadingViewProps, 'title' | 'subtitle'>) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();

  if (FOOD_LOADING_IN_RESTAURANT_APP && !isNormalApp) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <FoodLoadingAnimation title={title} subtitle={subtitle} />
        <View className="pb-9">
          <SecureFooter />
        </View>
      </SafeAreaView>
    );
  }

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
