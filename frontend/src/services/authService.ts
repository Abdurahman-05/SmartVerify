import { addStaff } from '@/lib/staff';
import type { NewStaffInput, StaffMember } from '@/lib/mock/staffAdmin';
import type { RegisterInput } from '@/lib/auth';
import type { SessionUser } from '@/store/session';

// Frontend only: the backend for these calls is not ready. Each function waits 600 ms and returns
// mock data. TODO: connect API — replace the body of each function with its request.

const STUB_DELAY_MS = 600;
const wait = () => new Promise<void>((resolve) => setTimeout(resolve, STUB_DELAY_MS));

/** The only code the stub accepts. */
export const STUB_EMAIL_CODE = '123456';

export class InvalidCodeError extends Error {}

export interface OwnerSignInInput {
  email: string;
  pin: string;
  rememberMe: boolean;
}

/** Owner or manager sign-in with email + PIN. TODO: connect API (POST /auth/login-email). */
export async function signInWithEmail(input: OwnerSignInInput): Promise<SessionUser> {
  await wait();
  return {
    userId: 'stub-owner',
    displayName: input.email.split('@')[0] ?? 'Owner',
    businessName: 'Abebe Coffee',
    role: 'owner',
    plan: 'restaurant',
    subscription: null,
  };
}

export interface PinResetInput {
  /** Owner and manager reset by email, staff by phone. */
  kind: 'owner' | 'staff';
  /** The email, or the 9-digit phone. */
  value: string;
}

/** Sends a PIN reset code. TODO: connect API (POST /auth/forgot-pin). */
export async function requestPinReset(_input: PinResetInput): Promise<void> {
  await wait();
}

/** Sends (or re-sends) the 6-digit sign-up code. TODO: connect API (POST /auth/email-code). */
export async function sendEmailCode(_email: string): Promise<void> {
  await wait();
}

/** Checks the sign-up code. The stub accepts "123456". TODO: connect API (POST /auth/verify-email). */
export async function verifyEmailCode(code: string): Promise<void> {
  await wait();
  if (code !== STUB_EMAIL_CODE) throw new InvalidCodeError();
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

/** Emails a manager an invite to set their own PIN. TODO: connect API (POST /staff/invite). */
export async function inviteManager(input: InviteManagerInput): Promise<StaffMember> {
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
