import { addStaff, USE_MOCK_STAFF } from '@/lib/staff';
import type { NewStaffInput, StaffMember } from '@/lib/mock/staffAdmin';
import { signInWithEmail as realSignInWithEmail } from '@/lib/api/auth';
import { ApiError, api } from '@/lib/api/client';
import { signIn, USE_MOCK_AUTH, type RegisterInput } from '@/lib/auth';
import { useStaff } from '@/features/staff/store';
import type { SessionUser } from '@/store/session';

// Auth calls not covered by src/lib/auth. The offline mock path (USE_MOCK_AUTH / USE_MOCK_STAFF)
// waits 600 ms and answers locally.

const STUB_DELAY_MS = 600;
const wait = () => new Promise<void>((resolve) => setTimeout(resolve, STUB_DELAY_MS));

/** The only code the offline mock accepts. */
export const STUB_EMAIL_CODE = '123456';

/** Wrong, expired or used-up sign-up code (`reason` from the server). */
export class InvalidCodeError extends Error {
  constructor(
    readonly reason: 'wrong' | 'expired' | 'tooManyTries' = 'wrong',
    readonly triesLeft?: number
  ) {
    super('INVALID_CODE');
  }
}

export interface OwnerSignInInput {
  email: string;
  pin: string;
  rememberMe: boolean;
}

/**
 * Owner or manager sign-in with email + PIN (POST /auth/sign-in-email). The user (and its plan)
 * comes from the server. The offline mock has no emails: it signs in the mock owner by PIN.
 */
export async function signInWithEmail(input: OwnerSignInInput): Promise<SessionUser> {
  if (USE_MOCK_AUTH) {
    const { owner } = useStaff.getState();
    return signIn({ phone: owner.phone, pin: input.pin, rememberMe: input.rememberMe });
  }
  return realSignInWithEmail(input);
}

export interface PinResetInput {
  /** Owner and manager reset by email, staff by phone. */
  kind: 'owner' | 'staff';
  /** The email, or the 9-digit phone. */
  value: string;
}

/** Waiters and chefs have no email: their owner or manager sets a new PIN for them. */
export class StaffResetByManagerError extends Error {
  constructor() {
    super('STAFF_RESET_BY_MANAGER');
  }
}

/** Emails an owner or manager a PIN reset code (POST /auth/forgot-pin). */
export async function requestPinReset(input: PinResetInput): Promise<void> {
  if (input.kind === 'staff') throw new StaffResetByManagerError();
  if (USE_MOCK_AUTH) {
    await wait();
    return;
  }
  await api('/auth/forgot-pin', { method: 'POST', body: { email: input.value } });
}

export interface EmailCodeSent {
  /** Seconds before another code can be asked for. */
  resendInSeconds: number;
  /** Development server without an email provider only: the code itself. */
  devCode?: string;
}

/** Sends (or re-sends) the 6-digit sign-up code (POST /auth/email-code). */
export async function sendEmailCode(email: string): Promise<EmailCodeSent> {
  if (USE_MOCK_AUTH) {
    // Offline mock: nothing is sent; the code is always 123456.
    await wait();
    return { resendInSeconds: 45, devCode: STUB_EMAIL_CODE };
  }
  return api<EmailCodeSent>('/auth/email-code', { method: 'POST', body: { email } });
}

/** Checks the sign-up code (POST /auth/verify-email). */
export async function verifyEmailCode(email: string, code: string): Promise<void> {
  if (USE_MOCK_AUTH) {
    await wait();
    if (code !== STUB_EMAIL_CODE) throw new InvalidCodeError();
    return;
  }
  try {
    await api('/auth/verify-email', { method: 'POST', body: { email, code } });
  } catch (error) {
    if (error instanceof ApiError && error.code === 'WRONG_CODE') {
      const reason = error.details?.reason;
      const triesLeft = error.details?.triesLeft;
      throw new InvalidCodeError(
        reason === 'expired' || reason === 'tooManyTries' ? reason : 'wrong',
        typeof triesLeft === 'number' ? triesLeft : undefined
      );
    }
    throw error;
  }
}

// What was typed on Create account waits here until its email is verified; only then is the
// account made.
let pendingSignup: RegisterInput | null = null;
export const holdSignup = (values: RegisterInput) => {
  pendingSignup = values;
};
export const peekSignup = () => pendingSignup;
export const takeSignup = () => {
  const values = pendingSignup;
  pendingSignup = null;
  return values;
};

export interface InviteManagerInput {
  name: string;
  email: string;
  /** 9 digits without +251. */
  phone: string;
}

/**
 * Owner only: creates a manager and emails them a temporary PIN for email sign-in
 * (POST /staff/invite). EXPO_PUBLIC_USE_MOCK_STAFF=true keeps the offline mock.
 */
export async function inviteManager(input: InviteManagerInput): Promise<StaffMember> {
  if (!USE_MOCK_STAFF) {
    return api<StaffMember>('/staff/invite', { method: 'POST', body: input });
  }
  await wait();
  return {
    id: `invite-${Date.now()}`,
    name: input.name,
    email: input.email,
    phone: input.phone,
    role: 'manager',
    active: false,
    canChangeDeliveryFee: true,
    canSeeReports: true,
    pinIsTemporary: false,
    editable: false,
    inviteSent: true,
  };
}

/** Adds a waiter or chef with a PIN set by the owner or manager. TODO: connect API (POST /staff). */
export const createStaff = (input: NewStaffInput): Promise<StaffMember> => addStaff(input);
