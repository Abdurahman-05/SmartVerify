import * as real from '@/lib/api/auth';
import * as mock from '@/lib/mock/auth';
import type { SessionUser } from '@/store/session';

export type { CreateAccountInput, SignInInput } from '@/lib/mock/auth';

/** EXPO_PUBLIC_USE_MOCK_AUTH=true uses the offline mock (src/lib/mock/auth.ts); default is the real backend. */
export const USE_MOCK_AUTH = process.env.EXPO_PUBLIC_USE_MOCK_AUTH === 'true';

export const signIn = USE_MOCK_AUTH ? mock.signIn : real.signIn;
export const createAccount = USE_MOCK_AUTH ? mock.createAccount : real.createAccount;
// The mock keeps no token: sign-out is local only and there is no session to restore at start.
export const signOut: () => Promise<void> = USE_MOCK_AUTH ? async () => {} : real.signOut;
export const getMe: () => Promise<SessionUser | null> = USE_MOCK_AUTH ? async () => null : real.getMe;
