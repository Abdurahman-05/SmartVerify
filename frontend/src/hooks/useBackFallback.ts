import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';
import { BackHandler } from 'react-native';

/**
 * Safety net for the phone's Back button: when there is no screen to go back to (the page was
 * opened by a replace, a push notification or a reset), go to `fallback` instead of leaving the
 * app. With a previous screen, Back works as usual (one step).
 */
export function useBackFallback(fallback: Href | null) {
  const router = useRouter();
  useFocusEffect(
    useCallback(() => {
      if (fallback === null) return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (router.canGoBack()) return false;
        router.replace(fallback);
        return true;
      });
      return () => sub.remove();
    }, [router, fallback])
  );
}
