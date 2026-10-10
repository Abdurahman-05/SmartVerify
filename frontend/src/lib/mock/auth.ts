import { useStaff } from '@/features/staff/store';
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

export class WrongCredentialsError extends Error {}

/** Owner first, then active staff. Staff share the owner's business and plan. Test sign-ins: src/lib/mock/staff.ts. */
export async function signIn(input: SignInInput): Promise<SessionUser> {
  await mockDelay();
  const { owner, staff } = useStaff.getState();

  if (input.phone === owner.phone && input.pin === owner.pin) {
    return {
      userId: owner.id,
      displayName: owner.name,
      businessName: owner.businessName,
      phone: owner.phone,
      role: 'owner',
      plan: owner.plan,
      subscription: owner.subscription,
    };
  }

  const member = staff.find((m) => m.active && m.phone === input.phone && m.pin === input.pin);
  if (!member) throw new WrongCredentialsError();

  return {
    userId: member.id,
    displayName: member.name,
    businessName: owner.businessName,
    phone: member.phone,
    role: member.role,
    plan: owner.plan,
    subscription: owner.subscription,
  };
}

export async function createAccount(input: CreateAccountInput): Promise<SessionUser> {
  await mockDelay();
  const owner = {
    id: `owner-${Date.now()}`,
    name: input.fullName.trim().split(/\s+/)[0],
    businessName: input.businessName.trim(),
    phone: input.phone,
    pin: input.pin,
    plan: null,
    subscription: null,
  };
  useStaff.getState().setOwner(owner);
  return {
    userId: owner.id,
    displayName: owner.name,
    businessName: owner.businessName,
    phone: owner.phone,
    role: 'owner',
    plan: null,
    subscription: null,
  };
}
