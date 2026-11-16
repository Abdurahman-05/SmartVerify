import { Check, ShieldCheck } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { colors } from '@/theme/tokens';

import { BankBadge } from './BankBadge';
import { GlassCard } from './GlassCard';
import { alpha, useGlass } from './glassTokens';
import { formatMoney } from './MoneyText';
import { ScreenBackground } from './ScreenBackground';
import { Text } from './Text';

// Design: docs/design/owner/verify-handoff/screens/14-checking.png
const DONE = '#22C55E';
const RING = 170;
const CIRCLE = 100;

/** A turning ring: coloured on the top and right; still when the phone asks for less motion. */
function Spinner({
  size,
  width,
  color,
  track,
  duration = 1100,
}: {
  size: number;
  width: number;
  color: string;
  track: string;
  duration?: number;
}) {
  const reduced = useReducedMotion();
  const turn = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    turn.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1);
    return () => cancelAnimation(turn);
  }, [reduced, turn, duration]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }));
  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: width,
          borderColor: track,
          borderTopColor: color,
          borderRightColor: color,
        },
        style,
      ]}
    />
  );
}

/** Soft halo behind the circle that breathes in and out (none with reduce motion). */
function Pulse({ color }: { color: string }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    scale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) })
      ),
      -1
    );
    return () => cancelAnimation(scale);
  }, [reduced, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View
      style={[
        { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: color },
        style,
      ]}
    />
  );
}

type StepState = 'done' | 'active' | 'todo';

/**
 * Checking payment: deep theme circle with a shield, a turning ring and a soft pulse; the amount
 * being checked with the bank; and the steps (scanned ✓, asking the bank …, comparing ○).
 */
export function CheckingView({
  title,
  subtitle,
  amount,
  bankCode,
}: {
  title: string;
  subtitle: string;
  amount: number;
  bankCode?: string | null;
}) {
  const { t } = useTranslation();
  const g = useGlass();
  const steps: { key: string; state: StepState }[] = [
    { key: 'scanned', state: 'done' },
    { key: 'asking', state: 'active' },
    { key: 'comparing', state: 'todo' },
  ];
  return (
    <ScreenBackground>
      <SafeAreaView className="flex-1">
        <View
          className="flex-1 items-center gap-4 px-4 pt-14"
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${title}. ${subtitle}`}
        >
          <View
            style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}
          >
            <Pulse color={alpha(g.primary, 0.18)} />
            <View className="absolute">
              <Spinner
                size={RING}
                width={5}
                color={g.primary}
                track="rgba(255,255,255,0.7)"
                duration={1200}
              />
            </View>
            <View
              style={{
                width: CIRCLE,
                height: CIRCLE,
                borderRadius: CIRCLE / 2,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: g.primaryDeep,
                boxShadow: `0 14px 28px ${alpha(g.primary, 0.3)}`,
              }}
            >
              <ShieldCheck size={46} color="#FFFFFF" strokeWidth={2} />
            </View>
          </View>

          <View className="items-center">
            <Text font="heading" className="text-center text-[28px] leading-[34px]">
              {title}
            </Text>
            <Text className="mt-1 text-center text-[15px]" style={{ color: colors.muted }}>
              {subtitle}
            </Text>
          </View>

          <GlassCard
            containerStyle={{ width: '100%' }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}
          >
            <View className="flex-1">
              <Text
                font="bold"
                className="text-[13px] uppercase tracking-[0.6px]"
                style={{ color: colors.muted }}
              >
                {t('verifyRestaurant.waitingFor')}
              </Text>
              <Text font="heading" className="text-[26px] leading-8">
                {formatMoney(amount)}
              </Text>
            </View>
            {bankCode ? <BankBadge code={bankCode} size={44} /> : null}
          </GlassCard>

          <GlassCard containerStyle={{ width: '100%' }} style={{ paddingHorizontal: 16 }}>
            {steps.map((step, i) => (
              <View
                key={step.key}
                className={`flex-row items-center gap-3 py-3.5 ${i ? 'border-t border-black/[0.07]' : ''}`}
              >
                {step.state === 'done' ? (
                  <View
                    className="h-7 w-7 items-center justify-center rounded-full"
                    style={{ backgroundColor: DONE }}
                  >
                    <Check size={16} color="#FFFFFF" strokeWidth={3} />
                  </View>
                ) : step.state === 'active' ? (
                  <Spinner size={28} width={3} color={g.primary} track={alpha(g.primary, 0.15)} />
                ) : (
                  <View
                    className="h-7 w-7 rounded-full"
                    style={{ borderWidth: 2.5, borderColor: 'rgba(30,26,28,0.2)' }}
                  />
                )}
                <Text
                  font={step.state === 'todo' ? 'body' : 'bold'}
                  className="flex-1 text-base"
                  style={{
                    color:
                      step.state === 'active'
                        ? g.primaryText
                        : step.state === 'todo'
                          ? colors.muted
                          : colors.text,
                  }}
                >
                  {t(`verifyRestaurant.checkingSteps.${step.key}`)}
                </Text>
              </View>
            ))}
          </GlassCard>

          <Text className="text-center text-sm" style={{ color: colors.muted }}>
            {t('verifyRestaurant.usuallySeconds')}
          </Text>
        </View>
      </SafeAreaView>
    </ScreenBackground>
  );
}
