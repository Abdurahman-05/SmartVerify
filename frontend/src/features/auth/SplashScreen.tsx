import { onlineManager } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as NativeSplash from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AuthBackground } from '@/components/ui/AuthBackground';
import { NoConnection } from '@/components/ui/NoConnection';
import { StarterLoader } from '@/components/ui/StarterLoader';
import { loadSavedUser } from '@/lib/api/token';
import { loadAppLock, useAppLock } from '@/lib/appLock';
import { getMe } from '@/lib/auth';
import { homeRouteFor, useSession } from '@/store/session';

const MIN_SPLASH_MS = 1000;

/**
 * Splash on the auth background: the logo loader, "Getting things ready" and three bouncing dots
 * while the saved sign-in is checked (at least 1 s). Signed in → that role's home; no saved
 * sign-in → Sign in. With reduce motion on, nothing moves.
 */
export default function SplashScreen() {
  const router = useRouter();
  const { t } = useTranslation();
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
    <AuthBackground>
      <View
        style={{ flex: 1, alignItems: 'center', paddingTop: 300 }}
        // The splash is drawn: now the native splash can go without a flash.
        onLayout={() => void NativeSplash.hideAsync().catch(() => undefined)}
      >
        <StatusBar style="dark" />
        <StarterLoader title={t('splash.ready')} subtitle={t('splash.moment')} />
      </View>
    </AuthBackground>
  );
}
