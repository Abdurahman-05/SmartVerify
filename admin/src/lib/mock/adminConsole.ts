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

/** Offline console: six made-up customers, default rules, nothing saved anywhere. */
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
/** Six made-up Addis Ababa businesses with a map point each. */
const places = [
  {
    id: 'offline-1',
    name: 'Bole Coffee House',
    area: 'Bole',
    lat: 8.9958,
    lng: 38.7869,
    address: 'Bole Road, near Edna Mall',
    landmark: 'Edna Mall',
  },
  {
    id: 'offline-2',
    name: 'Piassa Pastry',
    area: 'Piassa',
    lat: 9.0336,
    lng: 38.7509,
    address: 'Churchill Avenue',
    landmark: 'Cathedral of St. George',
  },
  {
    id: 'offline-3',
    name: 'CMC Burger',
    area: 'CMC',
    lat: 9.0189,
    lng: 38.8436,
    address: 'CMC Road',
    landmark: 'St. Michael Church',
  },
  {
    id: 'offline-4',
    name: 'Megenagna Juice',
    area: 'Megenagna',
    lat: 9.0203,
    lng: 38.8017,
    address: 'Megenagna Square',
    landmark: 'Zefmesh Grand Mall',
  },
  {
    id: 'offline-5',
    name: 'Sarbet Pizza',
    area: 'Sarbet',
    lat: 8.9965,
    lng: 38.7383,
    address: 'Sarbet, Old Airport road',
    landmark: 'Canada Embassy',
  },
  {
    id: 'offline-6',
    name: 'Kazanchis Grill',
    area: 'Kazanchis',
    lat: 9.0164,
    lng: 38.7667,
    address: 'Kazanchis, Africa Avenue',
    landmark: 'Intercontinental Hotel',
  },
];
// One without a location, so the "No location" look shows too.
const withoutLocation = new Set(['offline-6']);
const located = (id: string) => !withoutLocation.has(id);
const customers = places.map((p, i) => ({
  id: p.id,
  name: p.name,
  businessType: 'Cafe',
  city: 'Addis Ababa',
  area: located(p.id) ? p.area : null,
  hasLocation: located(p.id),
  plan: (i % 2 ? 'restaurant' : 'normal') as PlanCode,
  ownerName: `Owner ${i + 1}`,
  ownerPhone: `+251 91 000 000${i + 1}`,
  status: 'trial' as const,
  endsAt: now(),
  daysLeft: 5 + i,
  exempt: false,
  priceEtb: null,
  period: null,
}));
const customer = customers[0]!;
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
    customers: {
      total: customers.length,
      trial: customers.length,
      active: 0,
      grace: 0,
      restricted: 0,
      suspended: 0,
    },
    dueSoon: [customer],
    checksToday: { verified: 0, notMatching: 0, unable: 0 },
    banks: [],
    gemini: { calls: 0, rateLimited: 0 },
  };
}

export async function getCustomers(q: CustomerQuery): Promise<CustomerList> {
  await mockDelay(300);
  const search = q.search?.toLowerCase();
  const items = customers.filter(
    (c) =>
      (!q.city || (c.city ?? '').toLowerCase().includes(q.city.toLowerCase())) &&
      (!q.plan || c.plan === q.plan) &&
      (!search || `${c.name} ${c.ownerPhone} ${c.area ?? ''}`.toLowerCase().includes(search))
  );
  return {
    items,
    total: items.length,
    all: customers.length,
    tabs: { overdue: 0, trial: customers.length, restricted: 0, new: customers.length },
    cities: ['Addis Ababa'],
  };
}

export async function getCustomer(id: string): Promise<CustomerDetail> {
  await mockDelay(300);
  const customer = customers.find((c) => c.id === id) ?? customers[0]!;
  const place = places.find((p) => p.id === customer.id)!;
  const has = located(customer.id);
  return {
    id,
    name: customer.name,
    businessType: customer.businessType,
    city: customer.city,
    address: has ? place.address : null,
    area: has ? place.area : null,
    landmark: has ? place.landmark : null,
    latitude: has ? place.lat : null,
    longitude: has ? place.lng : null,
    locationSetAt: has ? new Date(Date.now() - 3 * 86400_000).toISOString() : null,
    createdAt: now(),
    plan: customer.plan,
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
