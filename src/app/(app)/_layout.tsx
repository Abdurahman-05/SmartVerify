import { Stack } from 'expo-router';

import { colors } from '@/theme/tokens';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="scan" options={{ animation: 'fade' }} />
      <Stack.Screen name="checking" options={{ gestureEnabled: false }} />
      <Stack.Screen name="payment-result" options={{ gestureEnabled: false }} />
      <Stack.Screen name="orders" />
      <Stack.Screen name="tips" />
      <Stack.Screen name="reports" />
      <Stack.Screen name="bank-accounts" />
      <Stack.Screen name="subscription" />
      <Stack.Screen name="bills" />
      <Stack.Screen name="chef" />
      <Stack.Screen name="admin" />
    </Stack>
  );
}
