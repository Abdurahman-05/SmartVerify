import type { ActivityCategory, ActivityItem, AdminProfile } from '@/lib/api/admin';

import { mockDelay } from './mock';

/** Offline admin: any email/password, any 6-digit code. Nothing leaves the device. */
let signedIn = false;
let twoStepOn = false;

export const setAdminToken = (_token: string | null) => undefined;
export const hasAdminToken = () => signedIn;

export async function adminSignIn(_email: string, _password: string) {
  await mockDelay(300);
  return twoStepOn ? ('code' as const) : ('setup' as const);
}

export async function startTwoStepSetup() {
  await mockDelay(200);
  return {
    secret: 'JBSWY3DPEHPK3PXP',
    otpauthUrl: 'otpauth://totp/Smart%20Verify%20Admin:offline',
  };
}

export async function confirmTwoStepSetup(_code: string) {
  await mockDelay(300);
  twoStepOn = true;
  signedIn = true;
  return [
    '4K9M-2QXA',
    '7TBD-8ZPL',
    'H3WC-5NRE',
    'Q6YJ-1VFS',
    'M8RT-3KXD',
    'P2HW-9ZCN',
    'V5GA-6TJE',
    'X7NB-4QMS',
  ];
}

export async function verifyTwoStep(_input: { code: string } | { backupCode: string }) {
  await mockDelay(300);
  signedIn = true;
}

export async function adminSignOut() {
  signedIn = false;
}

export async function getAdminProfile(): Promise<AdminProfile> {
  await mockDelay(200);
  return {
    id: 'admin-offline',
    email: 'admin@offline',
    name: 'Offline admin',
    role: 'super_admin',
    idleTimeoutMinutes: 120,
    backupCodesLeft: 8,
  };
}

export async function getActivity(params: { category?: ActivityCategory; before?: string }) {
  await mockDelay(300);
  const items: ActivityItem[] = [
    {
      id: 'a1',
      createdAt: new Date().toISOString(),
      adminName: 'Offline admin',
      category: 'sign_in',
      action: 'signed_in',
      businessName: null,
      details: null,
      ip: '127.0.0.1',
      userAgent: 'Offline',
    },
  ];
  const filtered = params.category ? items.filter((i) => i.category === params.category) : items;
  return { items: filtered, nextBefore: null, total: filtered.length };
}
