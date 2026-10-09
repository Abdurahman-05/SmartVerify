import * as SecureStore from 'expo-secure-store';

import { setAuthToken } from './client';

const KEY = 'smartverify.authToken';

/** Remember me on: kept in the device's secure storage. Off: memory only, gone when the app closes. */
export async function saveToken(token: string, remember: boolean) {
  setAuthToken(token);
  if (remember) await SecureStore.setItemAsync(KEY, token);
  else await SecureStore.deleteItemAsync(KEY);
}

/** Loads a remembered token into the client. Returns null if there is none. */
export async function loadToken(): Promise<string | null> {
  const token = await SecureStore.getItemAsync(KEY);
  setAuthToken(token);
  return token;
}

export async function clearToken() {
  setAuthToken(null);
  await SecureStore.deleteItemAsync(KEY);
}
