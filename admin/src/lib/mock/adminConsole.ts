import type {
  Announcement,
  CustomerDetail,
  CustomerList,
  CustomerQuery,
  Dashboard,
  HealthPage,
  NewAnnouncement,
  PaymentReviewItem,
  PlanCode,
  PlatformSettings,
  SettingsPage,
} from '@/lib/api/adminConsole';

import { mockDelay } from './mock';

/** Offline console: one made-up customer, default rules, nothing saved anywhere. */
const now = () => new Date().toISOString();
let settings: PlatformSettings = {
  trialEnabled: true,
  trialDays: 14,
  reminderDays: [7, 3, 1],
  graceDays: 3,
  restrictedDays: 7,
  restrictedBlocks: ['receipt_checks', 'orders', 'reports', 'staff'],
  priceNormalMonthly: 700,
  priceNormalQuarterly: 1500,
  priceRestaurantMonthly: 4000,
};
const customer = {
  id: 'offline-1',
  name: 'Offline Cafe',
  businessType: 'Cafe',
  city: 'Addis Ababa',
  plan: 'normal' as PlanCode,
  ownerName: 'Offline Owner',
  ownerPhone: '+251 91 000 0000',
  status: 'trial' as const,
  endsAt: now(),
  daysLeft: 5,
  exempt: false,
  priceEtb: null,
  period: null,
};
let announcements: Announcement[] = [];

export async function getDashboard(): Promise<Dashboard> {
  await mockDelay(300);
  return {
    needs: {
      reviews: 0,
      reviewsOlderThanDay: 0,
      overdue: 0,
      restrictedThisWeek: 0,
      errors: 0,
      topError: null,
    },
    money: { thisMonth: 0, lastMonth: 0, expected30: 0, months: [] },
    customers: { total: 1, trial: 1, active: 0, grace: 0, restricted: 0, suspended: 0 },
    dueSoon: [customer],
    checksToday: { verified: 0, notMatching: 0, unable: 0 },
    banks: [],
    gemini: { calls: 0, rateLimited: 0 },
  };
}

export async function getCustomers(_q: CustomerQuery): Promise<CustomerList> {
  await mockDelay(300);
  return {
    items: [customer],
    total: 1,
    all: 1,
    tabs: { overdue: 0, trial: 1, restricted: 0, new: 1 },
    cities: ['Addis Ababa'],
  };
}

export async function getCustomer(id: string): Promise<CustomerDetail> {
  await mockDelay(300);
  return {
    id,
    name: customer.name,
    businessType: customer.businessType,
    city: customer.city,
    address: null,
    latitude: 9.0108,
    longitude: 38.7613,
    createdAt: now(),
    plan: 'normal',
    suspendedAt: null,
    exempt: false,
    exemptReason: null,
    access: {
      status: 'trial',
      endsAt: now(),
      daysLeft: 5,
      nextStepAt: now(),
      suspendedByAdmin: false,
      steps: { endsAt: now(), graceEndsAt: now(), restrictedEndsAt: now() },
    },
    current: null,
    prices: { normalMonthly: 700, normalQuarterly: 1500, restaurantMonthly: 4000 },
    payments: [],
    pendingReviews: [],
    people: [
      { name: customer.ownerName, role: 'owner', phone: customer.ownerPhone, lastSignInAt: now() },
    ],
    usage: { receiptChecks: 0, verified: 0, activeDevices: 1 },
    banks: ['CBE'],
    notes: [],
  };
}

const done = async () => {
  await mockDelay(200);
};
export const extendCustomer = (_id: string, _days: number, _note?: string) => done();
export const markCustomerPaid = (_id: string, _plan: PlanCode, _period: string, _note?: string) =>
  done();
export const suspendCustomer = (_id: string, _suspended: boolean, _note?: string) => done();
export const changeCustomerPlan = (_id: string, _plan: PlanCode) => done();
export const exemptCustomer = (_id: string, _exempt: boolean, _reason?: string) => done();
export const addCustomerNote = (_id: string, _text: string) => done();

export async function getReviews(_status: 'pending' | 'approved' | 'rejected') {
  await mockDelay(200);
  return { pending: 0, items: [] as PaymentReviewItem[] };
}
export const decideReview = (
  _id: string,
  _decision: 'approve' | 'reject' | 'ask_rest',
  _note?: string
) => done();

export async function getSettingsPage(): Promise<SettingsPage> {
  await mockDelay(200);
  return {
    settings,
    exceptions: [],
    impact: { overdue: 0, restricted: 0 },
    planCounts: { normal: 1, restaurant: 0 },
    payTo: { cbe: { name: 'Smart Verify (offline)', last4: '0000' }, telebirr: null },
    telegram: false,
  };
}
export async function saveSettings(next: PlatformSettings) {
  await mockDelay(200);
  settings = next;
  return settings;
}

export async function getHealth(_recheck = false): Promise<HealthPage> {
  await mockDelay(200);
  return {
    app: { p50: null, p95: null, samples: 0 },
    database: { ok: true, ms: 0, sizeMb: 0 },
    server: { uptimeSeconds: 0, memoryMb: 0, memoryPercent: 0, node: 'offline' },
    banks: [],
    reading: { geminiCalls: 0, rateLimited: 0, ocrFallback: 0, geminiConfigured: false },
    errors: [],
  };
}
export const resolveError = (_id: string) => done();
export async function sendTestAlert() {
  await mockDelay(200);
  return { sent: false };
}

export async function getAnnouncements() {
  await mockDelay(200);
  return announcements;
}
export async function createAnnouncement(a: NewAnnouncement) {
  await mockDelay(200);
  announcements = [
    {
      id: String(Date.now()),
      ...a,
      plan: a.plan ?? null,
      city: a.city ?? null,
      createdBy: 'Offline admin',
      state: 'showing',
    },
    ...announcements,
  ];
}
export const endAnnouncement = (_id: string) => done();

export const setIdleTimeout = (_minutes: 30 | 120 | 480) => done();
export async function getOtherSessions() {
  await mockDelay(100);
  return { others: 0 };
}
export const signOutOtherSessions = () => done();
export const downloadCsv = (_kind: 'customers' | 'activity', _q: CustomerQuery = {}) => done();
