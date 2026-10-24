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
      <Stack.Screen name="bills/[id]/cash-saved" options={{ gestureEnabled: false }} />
      <Stack.Screen name="verify-restaurant/index" />
      <Stack.Screen name="verify-restaurant/checking" options={{ gestureEnabled: false }} />
      <Stack.Screen name="verify-restaurant/result" options={{ gestureEnabled: false }} />
      <Stack.Screen name="chef" />
      <Stack.Screen name="kitchen/index" />
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
      <Stack.Screen name="change-pin" />
      <Stack.Screen name="verify/qr-result" />
    </Stack>
  );
}
