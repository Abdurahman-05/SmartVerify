import type { CreateAccountInput, SignInInput } from '@/lib/mock/auth';
import type { SessionUser } from '@/store/session';

import { api, ApiError } from './client';
import { clearToken, loadToken, saveToken } from './token';

/** Sign-up input: the mock's fields plus the owner's email (the backend stores it). */
export type RegisterInput = CreateAccountInput & { email: string };

interface AuthResponse {
  token: string;
  expiresAt: string;
  user: SessionUser;
}

/** POST /auth/sign-in. Owner (6-digit PIN) or active staff (4-digit PIN); phone is 9 digits without +251. */
export async function signIn(input: SignInInput): Promise<SessionUser> {
  const res = await api<AuthResponse>('/auth/sign-in', { method: 'POST', body: input });
  await saveToken(res.token, input.rememberMe);
  return res.user;
}

/** POST /auth/sign-in-email. Owner or manager with email + PIN; same token and user as sign-in. */
export async function signInWithEmail(input: {
  email: string;
  pin: string;
  rememberMe: boolean;
}): Promise<SessionUser> {
  const res = await api<AuthResponse>('/auth/sign-in-email', { method: 'POST', body: input });
  await saveToken(res.token, input.rememberMe);
  return res.user;
}

/** POST /auth/register. Creates the owner and business (no plan yet). The new session is remembered. */
export async function createAccount(input: RegisterInput): Promise<SessionUser> {
  const res = await api<AuthResponse>('/auth/register', { method: 'POST', body: input });
  await saveToken(res.token, true);
  return res.user;
}

/** POST /auth/register-shop. Shop owner: name, shop name, phone and a 4-digit PIN; no email. */
export async function createShopAccount(input: CreateAccountInput): Promise<SessionUser> {
  const res = await api<AuthResponse>('/auth/register-shop', { method: 'POST', body: input });
  await saveToken(res.token, true);
  return res.user;
}

/** POST /auth/change-pin — needs the current PIN. Other devices are signed out. */
export async function changePin(currentPin: string, newPin: string): Promise<void> {
  await api('/auth/change-pin', { method: 'POST', body: { currentPin, newPin } });
}

/** POST /auth/sign-out, then forget the token even if the server could not be reached. */
export async function signOut(): Promise<void> {
  try {
    await api('/auth/sign-out', { method: 'POST' });
  } catch {
    // The token is dropped locally either way.
  } finally {
    await clearToken();
  }
}

/**
 * Restores the session from a remembered token (GET /auth/me).
 * Returns null when there is no token or the server rejected it. Network errors are thrown.
 */
export async function getMe(): Promise<SessionUser | null> {
  if (!(await loadToken())) return null;
  try {
    return await api<SessionUser>('/auth/me');
  } catch (error) {
    if (error instanceof ApiError && error.code === 'UNAUTHORIZED') {
      await clearToken();
      return null;
    }
    throw error;
  }
}
