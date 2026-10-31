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
  const ready = fontsLoaded || fontError !== null;

  // The server rejected the session (expired, signed out, deactivated): forget it and go to sign in.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void clearToken();
      useSession.getState().signOut();
      router.replace('/sign-in');
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

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
      </View>
    </PersistQueryClientProvider>
  );
}
