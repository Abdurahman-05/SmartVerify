import '@/global.css';
import '@/i18n';

import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_600SemiBold } from '@expo-google-fonts/dm-sans/600SemiBold';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { Sora_600SemiBold } from '@expo-google-fonts/sora/600SemiBold';
import { Sora_700Bold } from '@expo-google-fonts/sora/700Bold';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { View } from 'react-native';

import {
  applyColorMode,
  ColorModeContext,
  initialColorMode,
  type ColorMode,
} from '@/theme/colorMode';
import { colors } from '@/theme/tokens';

/** The Smart Verify team's admin console (web only). Nothing here ships in the phone app. */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    Sora_600SemiBold,
    Sora_700Bold,
  });
  // Admin data is never kept after the tab closes: one in-memory cache, short-lived.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
      })
  );

  // Day or night: set before the first paint, so the page never flashes the other one.
  const [mode, setMode] = useState<ColorMode>(() => {
    const first = initialColorMode();
    applyColorMode(first);
    return first;
  });
  const toggle = () => {
    const next = mode === 'dark' ? 'light' : 'dark';
    applyColorMode(next, true);
    setMode(next);
  };

  if (!fontsLoaded && !fontError) return null;
  return (
    <QueryClientProvider client={queryClient}>
      <ColorModeContext.Provider value={{ mode, toggle }}>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        {/* Redrawn on a change so every color read in code updates; loaded data stays. */}
        <View key={mode} style={{ flex: 1 }}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          />
        </View>
      </ColorModeContext.Provider>
    </QueryClientProvider>
  );
}
