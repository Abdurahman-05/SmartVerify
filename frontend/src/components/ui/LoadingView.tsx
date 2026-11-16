import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useReducedMotion } from '@/hooks/useReducedMotion';

import { ChevronLeft } from 'lucide-react-native';

import { PageLoader } from './PageLoader';
import { ScreenBackground } from './ScreenBackground';
import { ScreenHeader } from './ScreenHeader';
import { TopBar } from './TopBar';
import { Text } from './Text';
import { GlassCard, HeroCard, ScreenBg } from '@/ui/glass';

interface LoadingViewProps {
  title?: string;
  /** Kept for callers; the loader shows only the title (or "Loading…"). */
  subtitle?: string;
  /** Header of the page being opened, shown on the slow-connection skeleton. */
  screenTitle?: string;
  onBack?: () => void;
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
    <ScreenBg>
      <SafeAreaView
        className="flex-1"
        accessibilityRole="progressbar"
        accessibilityLabel={t('loading.slow')}
      >
        <ScreenHeader title={screenTitle ?? ''} onBack={onBack} />
        <HeroCard className="mx-4 gap-2.5 px-5 py-4">
          <View className="h-3.5 w-[55%] rounded-full bg-white/30" />
          <View className="h-[30px] w-[45%] rounded-lg bg-white/40" />
        </HeroCard>
        <View className="flex-row gap-2 overflow-hidden px-4 pb-2.5 pt-3.5">
          {[90, 70, 96, 84].map((width) => (
            <Bone key={width} animate={animate} width={width} className="h-12 rounded-full" />
          ))}
        </View>
        <View className="flex-1 gap-2 overflow-hidden px-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <GlassCard key={i} className="flex-row items-center gap-3 p-3">
              <Bone animate={animate} className="h-12 w-12 rounded-[14px]" />
              <View className="flex-1 gap-2">
                <Bone animate={animate} className="h-4 w-3/5 rounded-lg" />
                <Bone animate={animate} className="h-3 w-2/5 rounded-lg" />
              </View>
              <View className="items-end gap-2">
                <Bone animate={animate} className="h-[18px] w-20 rounded-lg" />
                <Bone animate={animate} className="h-3.5 w-16 rounded-xl" />
              </View>
            </GlassCard>
          ))}
        </View>
        <Text font="bold" tone="muted" className="pb-6 pt-2.5 text-center text-base">
          {t('loading.slow')}
        </Text>
      </SafeAreaView>
    </ScreenBg>
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
  return <BrandLoading title={title} screenTitle={screenTitle} onBack={onBack} />;
}

/** The page's background (and its title bar, when known) with the loader over it. */
function BrandLoading({
  title,
  screenTitle,
  onBack,
}: Pick<LoadingViewProps, 'title' | 'screenTitle' | 'onBack'>) {
  const { t } = useTranslation();
  return (
    <ScreenBackground>
      <SafeAreaView className="flex-1">
        {screenTitle ? (
          <View className="px-4 pt-2">
            <TopBar
              title={screenTitle}
              left={
                onBack ? { icon: ChevronLeft, onPress: onBack, label: t('common.back') } : undefined
              }
            />
          </View>
        ) : null}
      </SafeAreaView>
      <PageLoader visible label={title} />
    </ScreenBackground>
  );
}
