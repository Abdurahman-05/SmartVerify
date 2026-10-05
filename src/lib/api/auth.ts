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
  return {
    userId: 'mock-user-1',
    displayName: 'Abebe',
    businessName: 'Abebe Coffee',
    role: 'owner',
    plan: 'normal',
    subscription: {
      plan: 'normal',
      period: 'monthly',
      priceEtb: 700,
      startedAt: new Date(Date.now() - 10 * 86400_000).toISOString(),
      endsAt: new Date(Date.now() + 20 * 86400_000).toISOString(),
    },
  };
}

export async function createAccount(input: CreateAccountInput): Promise<SessionUser> {
  await mockDelay();
  return {
    userId: 'mock-user-new',
    displayName: input.fullName.trim().split(/\s+/)[0],
    businessName: input.businessName.trim(),
    role: 'owner',
    plan: null,
    subscription: null,
  };
}
