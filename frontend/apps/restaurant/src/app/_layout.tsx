import '@/global.css';
import '@/i18n';

import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_600SemiBold } from '@expo-google-fonts/dm-sans/600SemiBold';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { Sora_600SemiBold } from '@expo-google-fonts/sora/600SemiBold';
import { Sora_700Bold } from '@expo-google-fonts/sora/700Bold';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { FirstThemeScreen } from '@/features/theme/FirstThemeScreen';
import { setUnauthorizedHandler } from '@/lib/api/client';
import { clearToken } from '@/lib/api/token';
import { CACHE_MAX_AGE, queryClient, queryPersister } from '@/lib/queryClient';
import { useSession } from '@/store/session';
import { useTheme } from '@/store/theme';
import { themeVars } from '@/theme/themes';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    Sora_600SemiBold,
    Sora_700Bold,
  });

  const themeId = useTheme((s) => s.themeId);
  const themeLoaded = useTheme((s) => s.loaded);
  const themeChosen = useTheme((s) => s.chosen);
  const ready = (fontsLoaded || fontError !== null) && themeLoaded;

  // The saved colour theme (first start: none yet, so the app asks).
  useEffect(() => {
    void useTheme.getState().load();
  }, []);

  // The server rejected the session (expired, signed out, deactivated): forget it and go to sign in.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void clearToken();
      useSession.getState().signOut();
      router.replace('/sign-in');
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // The green JS splash hides the native one once it is drawn. First start shows the theme
  // picker instead (no JS splash), so hide it here; the timer is only a safety net.
  useEffect(() => {
    if (!ready) return;
    if (!themeChosen) {
      void SplashScreen.hideAsync();
      return;
    }
    const fallback = setTimeout(() => void SplashScreen.hideAsync(), 4000);
    return () => clearTimeout(fallback);
  }, [ready, themeChosen]);

  if (!ready) return null;
  if (!themeChosen) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <FirstThemeScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: queryPersister, maxAge: CACHE_MAX_AGE }}
    >
      <View style={[{ flex: 1 }, themeVars(themeId)]}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
        <OfflineBanner />
      </View>
    </PersistQueryClientProvider>
  );
}
