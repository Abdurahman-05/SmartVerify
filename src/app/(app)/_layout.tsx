import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="home" />
      <Stack.Screen name="verify" />
      <Stack.Screen name="transactions" />
      <Stack.Screen name="reports" />
      <Stack.Screen name="bank-accounts" />
      <Stack.Screen name="subscription" />
      <Stack.Screen name="orders" />
      <Stack.Screen name="bills" />
      <Stack.Screen name="tips" />
      <Stack.Screen name="chef" />
      <Stack.Screen name="admin" />
    </Stack>
  );
}
