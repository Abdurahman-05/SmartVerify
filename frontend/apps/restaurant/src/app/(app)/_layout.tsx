import { useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { LockOverlay } from '@/features/lock/LockOverlay';
import { WrongAppScreen } from '@/features/variant/WrongAppScreen';
import { notificationsKey } from '@/lib/notifications';
import { listenToPushes, registerForPush } from '@/lib/push';
import { belongsToOtherApp } from '@/lib/variant';
import { useFeatures } from '@/store/features';
import { targetOf } from '@/features/notifications/target';
import { homeRouteFor, useSession, type Role } from '@/store/session';
import { useBrandColors } from '@/store/theme';

const ownerOnly: Role[] = ['owner'];
const managers: Role[] = ['owner', 'manager'];
/** First route segment -> roles allowed in. Matches the backend's role checks. */
const guardedRoles: Record<string, Role[]> = {
  'bank-accounts': ownerOnly,
  'add-bank-account': ownerOnly,
  menu: managers,
  setup: managers,
  admin: managers,
  'tips-admin': managers,
  staff: managers,
};

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
  // A push arrives: the Alerts badge updates at once. Tapping one opens what it is about.
  const queryClient = useQueryClient();
  const router = useRouter();
  useEffect(
    () =>
      listenToPushes(
        () => void queryClient.invalidateQueries({ queryKey: notificationsKey }),
        (data) => {
          // Straight to what the push is about; anything else opens Alerts.
          const target =
            typeof data.type === 'string'
              ? targetOf(data.type, data, useSession.getState().user?.role)
              : null;
          router.push(target ?? '/notifications');
        }
      ),
    [queryClient, router]
  );
  // Each business uses its own app: restaurants the Restaurant app, shops the Shop app.
  const { tint } = useBrandColors();
  const wrongApp = useSession((s) => belongsToOtherApp(s.user?.plan));
  // Role guard: a wrong role opening these by deep link or notification goes Home.
  const role = useSession((s) => s.user?.role);
  const segments = useSegments() as string[];
  const first = segments.find((s) => !s.startsWith('(')) ?? '';
  const allowed = guardedRoles[first];
  const blocked = !!role && !!allowed && !allowed.includes(role);
  useEffect(() => {
    // Straight to that role's own home (not through the splash screen).
    if (blocked) router.replace(homeRouteFor(useSession.getState().user));
  }, [blocked, router]);
  if (wrongApp) return <WrongAppScreen />;
  if (blocked) return null;

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tint } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="scan" options={{ animation: 'fade' }} />
        <Stack.Screen name="checking" options={{ gestureEnabled: false }} />
        <Stack.Screen name="payment-result" options={{ gestureEnabled: false }} />
        <Stack.Screen name="orders" />
        <Stack.Screen name="order-sent" options={{ gestureEnabled: false }} />
        <Stack.Screen name="tips" />
        <Stack.Screen name="reports" />
        <Stack.Screen name="transaction/[id]" />
        <Stack.Screen name="bank-accounts" />
        <Stack.Screen name="add-bank-account" />
        <Stack.Screen name="subscription" />
        <Stack.Screen name="subscription-started" options={{ gestureEnabled: false }} />
        <Stack.Screen name="bills/index" />
        <Stack.Screen name="bills/[id]/index" />
        <Stack.Screen name="bills/[id]/cash" />
        <Stack.Screen name="bills/[id]/add" />
        <Stack.Screen name="bills/[id]/cash-saved" options={{ gestureEnabled: false }} />
        <Stack.Screen name="verify-restaurant/index" />
        <Stack.Screen name="verify-restaurant/checking" options={{ gestureEnabled: false }} />
        <Stack.Screen name="verify-restaurant/result" options={{ gestureEnabled: false }} />
        <Stack.Screen name="help" />
        <Stack.Screen name="staff/index" />
        <Stack.Screen name="staff/add" />
        <Stack.Screen name="staff/[id]" />
        <Stack.Screen name="menu/index" />
        <Stack.Screen name="menu/edit" />
        <Stack.Screen name="menu/packs/index" />
        <Stack.Screen name="menu/packs/[key]" />
        <Stack.Screen name="setup/tables" />
        <Stack.Screen name="setup/fees" />
        <Stack.Screen name="setup/table-categories" />
        <Stack.Screen name="setup/table-category" />
        <Stack.Screen name="menu/categories" />
        <Stack.Screen name="menu/category" />
        <Stack.Screen name="kitchen/[id]" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="tips-admin" />
        <Stack.Screen name="verify-tips" />
        <Stack.Screen name="change-pin" />
        <Stack.Screen name="extra-features" />
        <Stack.Screen name="verify/qr-result" />
      </Stack>
      {/* Over everything while locked (passcode / fingerprint). */}
      <LockOverlay />
    </>
  );
}
