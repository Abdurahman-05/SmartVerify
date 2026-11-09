import { onlineManager } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as NativeSplash from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { NoConnection } from '@/components/ui/NoConnection';
import { loadSavedUser } from '@/lib/api/token';
import { loadAppLock, useAppLock } from '@/lib/appLock';
import { getMe } from '@/lib/auth';
import { homeRouteFor, useSession } from '@/store/session';
import { useBrandColors } from '@/store/theme';

// The ገ and the yellow check without a background: the screen behind is the theme colour.
const logo = require('../../../assets/images/logo-mark.png') as number;

const DOT = '#F5B301';
const MIN_SPLASH_MS = 1000;

/** One yellow dot going up and down; each dot starts a little after the one before. */
function Dot({ index }: { index: number }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withDelay(
      index * 150,
      withRepeat(
        withSequence(withTiming(-14, { duration: 500 }), withTiming(0, { duration: 500 })),
        -1
      )
    );
  }, [index, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View
      style={[{ width: 14, height: 14, borderRadius: 7, backgroundColor: DOT }, style]}
    />
  );
}

/**
 * Splash in the chosen theme colour: the logo and three bouncing dots while the saved sign-in is checked (at least
 * 1 s). Signed in → that role's home; no saved sign-in → Sign in.
 */
export default function SplashScreen() {
  const router = useRouter();
  // The chosen theme is already loaded (the root layout waits for it).
  const brand = useBrandColors();
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

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: brand.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      // The splash is drawn: now the native splash can go without a flash.
      onLayout={() => void NativeSplash.hideAsync().catch(() => undefined)}
    >
      <StatusBar style="light" />
      <Image source={logo} style={{ width: 220, height: 220 }} contentFit="contain" />
      <View
        style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 28, height: 28 }}
      >
        <Dot index={0} />
        <Dot index={1} />
        <Dot index={2} />
      </View>
    </View>
  );
}
