import { useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { LockOverlay } from '@/features/lock/LockOverlay';
import { WrongAppScreen } from '@/features/variant/WrongAppScreen';
import { notificationsKey } from '@/lib/notifications';
import { listenToPushes, registerForPush } from '@/lib/push';
import { belongsToOtherApp } from '@/lib/variant';
import { useFeatures } from '@/store/features';
import { useSession } from '@/store/session';
import { colors } from '@/theme/tokens';

export default function AppLayout() {
  // Which owner extras are on: asked after sign-in and whenever the app opens signed in.
  const userId = useSession((s) => s.user?.userId);
  useEffect(() => {
    if (userId) void useFeatures.getState().load();
  }, [userId]);
  // Push: this phone gets the signed-in person's alerts when the app is closed.
  useEffect(() => {
    if (userId) void registerForPush();
  }, [userId]);
  // A push arrives: the Alerts badge updates at once. Tapping one opens Alerts.
  const queryClient = useQueryClient();
  const router = useRouter();
  useEffect(
    () =>
      listenToPushes(
        () => void queryClient.invalidateQueries({ queryKey: notificationsKey }),
        () => router.push('/notifications')
      ),
    [queryClient, router]
  );
  // Each business uses its own app: restaurants the Restaurant app, shops the Shop app.
  const wrongApp = useSession((s) => belongsToOtherApp(s.user?.plan));
  if (wrongApp) return <WrongAppScreen />;

  return (
    <>
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="scan" options={{ animation: 'fade' }} />
        <Stack.Screen name="checking" options={{ gestureEnabled: false }} />
        <Stack.Screen name="payment-result" options={{ gestureEnabled: false }} />
        <Stack.Screen name="reports" />
        <Stack.Screen name="transaction/[id]" />
        <Stack.Screen name="bank-accounts" />
        <Stack.Screen name="add-bank-account" />
        <Stack.Screen name="subscription" />
        <Stack.Screen name="subscription-started" options={{ gestureEnabled: false }} />
        <Stack.Screen name="help" />
        <Stack.Screen name="staff/index" />
        <Stack.Screen name="staff/add" />
        <Stack.Screen name="staff/[id]" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="change-pin" />
        <Stack.Screen name="verify/qr-result" />
      </Stack>
      {/* Over everything while locked (passcode / fingerprint). */}
      <LockOverlay />
    </>
  );
}
