import * as SecureStore from 'expo-secure-store';

import { useSession, type SessionUser } from '@/store/session';

import { setAuthToken } from './client';

const KEY = 'smartverify.authToken';
/** The remembered user's profile (no secrets), so the app opens without internet. */
const USER_KEY = 'smartverify.user';

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
  await SecureStore.deleteItemAsync(USER_KEY);
}

/** The remembered user, with their token loaded; null without a remembered sign in. */
export async function loadSavedUser(): Promise<SessionUser | null> {
  if (!(await loadToken())) return null;
  const saved = await SecureStore.getItemAsync(USER_KEY);
  try {
    return saved ? (JSON.parse(saved) as SessionUser) : null;
  } catch {
    return null;
  }
}

// Keep the remembered user's profile up to date (only when "remember me" kept the token).
useSession.subscribe((state, prev) => {
  if (!state.user || state.user === prev.user) return;
  const user = state.user;
  void SecureStore.getItemAsync(KEY).then((token) =>
    token ? SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)) : undefined
  );
});
