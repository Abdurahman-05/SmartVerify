import { api } from './client';

/**
 * The Smart Verify team's admin (web). Its token is separate from business sessions and is kept
 * in memory only: closing or reloading the tab signs out.
 */
let adminToken: string | null = null;
export const setAdminToken = (token: string | null) => {
  adminToken = token;
};
export const hasAdminToken = () => adminToken !== null;

export interface AdminProfile {
  id: string;
  email: string;
  name: string;
  role: 'super_admin';
  idleTimeoutMinutes: number;
  backupCodesLeft: number;
}

export type ActivityCategory = 'money' | 'customers' | 'rules' | 'sign_in' | 'private_data';

export interface ActivityItem {
  id: string;
  createdAt: string;
  adminName: string | null;
  category: ActivityCategory;
  action: string;
  businessName: string | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
}

const call = <T>(path: string, options: Parameters<typeof api>[1] = {}) =>
  api<T>(path, { ...options, token: adminToken });

/** Step 1. The answer's token is only good for step 2. */
export async function adminSignIn(email: string, password: string) {
  const res = await call<{ token: string; next: 'setup' | 'code' }>('/admin/auth/sign-in', {
    method: 'POST',
    body: { email, password },
  });
  setAdminToken(res.token);
  return res.next;
}

/** First sign-in: the authenticator key (and otpauth link). */
export const startTwoStepSetup = () =>
  call<{ secret: string; otpauthUrl: string }>('/admin/auth/setup', { method: 'POST' });

/** The first code turns two-step on; answers the backup codes (shown once). */
export async function confirmTwoStepSetup(code: string) {
  const res = await call<{ token: string; backupCodes: string[] }>('/admin/auth/setup/confirm', {
    method: 'POST',
    body: { code },
  });
  setAdminToken(res.token);
  return res.backupCodes;
}

/** Step 2: the 6-digit code or a backup code. */
export async function verifyTwoStep(input: { code: string } | { backupCode: string }) {
  const res = await call<{ token: string }>('/admin/auth/verify', { method: 'POST', body: input });
  setAdminToken(res.token);
}

export async function adminSignOut() {
  try {
    if (adminToken) await call<void>('/admin/auth/sign-out', { method: 'POST' });
  } finally {
    setAdminToken(null);
  }
}

export const getAdminProfile = () => call<AdminProfile>('/admin/me');

export const getActivity = (params: { category?: ActivityCategory; before?: string }) =>
  call<{ items: ActivityItem[]; nextBefore: string | null; total: number }>('/admin/activity', {
    query: { category: params.category, before: params.before },
  });
