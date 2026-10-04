import type { SessionUser } from '@/store/session';

import { mockDelay } from './mock';

export interface SignInInput {
  phone: string;
  pin: string;
  rememberMe: boolean;
}

export interface CreateAccountInput {
  fullName: string;
  businessName: string;
  phone: string;
  pin: string;
}

export async function signIn(_input: SignInInput): Promise<SessionUser> {
  await mockDelay();
  return { userId: 'mock-user-1', role: 'owner', plan: 'normal' };
}

export async function createAccount(_input: CreateAccountInput): Promise<SessionUser> {
  await mockDelay();
  return { userId: 'mock-user-new', role: 'owner', plan: null };
}
