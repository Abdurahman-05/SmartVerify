import { onlineManager } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as NativeSplash from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

import { AuthBackground } from '@/components/ui/AuthBackground';
import { NoConnection } from '@/components/ui/NoConnection';
import { Text } from '@/components/ui/Text';
import { loadSavedUser } from '@/lib/api/token';
import { loadAppLock, useAppLock } from '@/lib/appLock';
import { getMe } from '@/lib/auth';
import { homeRouteFor, useSession } from '@/store/session';

import { AUTH } from './AuthParts';

// The ገ with its ✓ badge (the image includes the badge).
const glyph = require('../../../assets/images/auth/logo-glyph.png') as number;

const LOGO = 112;
const RING_INSET = 14;
const AMBER = '#F59E0B';
const DOT_COLORS = [AUTH.p, AUTH.p2, AMBER];
const MIN_SPLASH_MS = 1000;

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
            borderTopColor: AUTH.p,
            borderRightColor: AMBER,
          },
          spin,
        ]}
      />
      <Animated.View style={pulse}>
        <LinearGradient
          colors={[AUTH.p2, AUTH.p, AUTH.pt]}
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
 * Splash on the auth background: the logo loader, "Getting things ready" and three bouncing dots
 * while the saved sign-in is checked (at least 1 s). Signed in → that role's home; no saved
 * sign-in → Sign in. With reduce motion on, nothing moves.
 */
export default function SplashScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const still = useReducedMotion();
  const [offline, setOffline] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const started = Date.now();
    const go = (href: Parameters<typeof router.replace>[0]) => {
      const wait = attempt === 0 ? Math.max(0, MIN_SPLASH_MS - (Date.now() - started)) : 0;
      setTimeout(() => {
        if (!cancelled) router.replace(href);
      }, wait);
    };

    void (async () => {
      await loadAppLock();
      const current = useSession.getState().user;
      if (current) return go(homeRouteFor(current));
      try {
        const user = await getMe();
        if (cancelled) return;
        if (!user) return go('/sign-in');
        useSession.getState().signIn(user);
        useAppLock.getState().lock(user.userId);
        go(homeRouteFor(user));
      } catch {
        // No internet: open with the remembered user; the server checks again when online.
        const saved = await loadSavedUser().catch(() => null);
        if (cancelled) return;
        if (saved) {
          useSession.getState().signIn(saved);
          useAppLock.getState().lock(saved.userId);
          return go(homeRouteFor(saved));
        }
        setOffline(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt, router]);

  // Opened offline: try again by itself as soon as the internet is back.
  useEffect(() => {
    if (!offline) return;
    return onlineManager.subscribe((online) => {
      if (!online) return;
      setOffline(false);
      setAttempt((n) => n + 1);
    });
  }, [offline]);

  if (offline) {
    return (
      <NoConnection
        // The first screen: nothing to go back to.
        fullPage
        onRetry={() => {
          setOffline(false);
          setAttempt((n) => n + 1);
        }}
      />
    );
  }

  const words = t('splash.ready').split(' ');
  const titleHead = words.length > 1 ? `${words.slice(0, -1).join(' ')} ` : '';

  return (
    <AuthBackground>
      <View
        style={{ flex: 1, alignItems: 'center', paddingTop: 300, gap: 26 }}
        // The splash is drawn: now the native splash can go without a flash.
        onLayout={() => void NativeSplash.hideAsync().catch(() => undefined)}
      >
        <StatusBar style="dark" />
        <LogoLoader still={still} />
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Text
            font="heading"
            className="text-center text-[22px]"
            style={{ color: AUTH.text }}
            accessibilityRole="header"
          >
            {titleHead}
            <Text font="heading" className="text-[22px]" style={{ color: AUTH.p }}>
              {words[words.length - 1]}
            </Text>
          </Text>
          <Text className="text-center text-[15px]" style={{ color: '#5E5559' }}>
            {t('splash.moment')}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, height: 26 }}>
          {DOT_COLORS.map((color, i) => (
            <Dot key={color} index={i} still={still} />
          ))}
        </View>
      </View>
    </AuthBackground>
  );
}
