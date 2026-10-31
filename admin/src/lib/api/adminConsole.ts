import { adminCall as call, currentAdminToken } from './admin';
import { API_BASE_URL } from './client';

/** The admin console's data: customers, money, rules, health and messages. */

export type AccessStatus = 'trial' | 'active' | 'grace' | 'restricted' | 'suspended';
export type PlanCode = 'normal' | 'normal_multi' | 'restaurant_normal' | 'restaurant';

export interface CustomerSummary {
  id: string;
  name: string;
  businessType: string | null;
  city: string | null;
  plan: PlanCode | null;
  ownerName: string;
  ownerPhone: string;
  status: AccessStatus;
  endsAt: string | null;
  daysLeft: number | null;
  exempt: boolean;
  priceEtb: number | null;
  period: string | null;
}

export interface BankSite {
  code: string;
  up: boolean | null;
  checkedAt: string | null;
  downSince: string | null;
  uptime: number | null;
}

export interface Dashboard {
  needs: {
    reviews: number;
    reviewsOlderThanDay: number;
    overdue: number;
    restrictedThisWeek: number;
    errors: number;
    topError: string | null;
  };
  money: {
    thisMonth: number;
    lastMonth: number;
    expected30: number;
    months: { month: string; etb: number }[];
  };
  customers: { total: number } & Record<AccessStatus, number>;
  dueSoon: CustomerSummary[];
  checksToday: { verified: number; notMatching: number; unable: number };
  banks: BankSite[];
  gemini: { calls: number; rateLimited: number };
}

export type CustomerFilter = 'all' | 'overdue' | 'trial' | 'restricted' | 'new';
export interface CustomerQuery {
  search?: string;
  plan?: PlanCode;
  city?: string;
  filter?: CustomerFilter;
  page?: number;
}
export interface CustomerList {
  items: CustomerSummary[];
  total: number;
  all: number;
  tabs: Record<Exclude<CustomerFilter, 'all'>, number>;
  cities: string[];
}

export interface CustomerDetail {
  id: string;
  name: string;
  businessType: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  plan: PlanCode | null;
  suspendedAt: string | null;
  exempt: boolean;
  exemptReason: string | null;
  access: {
    status: AccessStatus;
    endsAt: string | null;
    daysLeft: number | null;
    nextStepAt: string | null;
    suspendedByAdmin: boolean;
    steps: { endsAt: string | null; graceEndsAt: string | null; restrictedEndsAt: string | null };
  };
  current: {
    plan: PlanCode;
    period: string;
    priceEtb: number;
    startedAt: string;
    endsAt: string;
  } | null;
  prices: {
    normalMonthly: number;
    normalQuarterly: number;
    /** Missing from older servers (and the mock). */
    normalMultiMonthly?: number;
    restaurantNormalMonthly?: number;
    restaurantNormalQuarterly?: number;
    restaurantMonthly: number;
  };
  payments: {
    id: string;
    plan: PlanCode;
    period: string;
    priceEtb: number;
    startedAt: string;
    endsAt: string;
    paymentMethod: string | null;
    reference: string | null;
    note: string | null;
    createdAt: string;
    cancelled: boolean;
  }[];
  pendingReviews: { id: string; expectedEtb: number; bankCode: string; createdAt: string }[];
  people: { name: string; role: string; phone: string | null; lastSignInAt: string | null }[];
  usage: { receiptChecks: number; verified: number; activeDevices: number };
  banks: string[];
  notes: { id: string; text: string; adminName: string; createdAt: string }[];
}

export interface PaymentReviewItem {
  id: string;
  businessId: string;
  businessName: string;
  plan: PlanCode;
  period: string;
  expectedEtb: number;
  bankCode: string;
  receiptKey: string;
  reference: string | null;
  paidEtb: number | null;
  reasons: string[];
  status: 'pending' | 'approved' | 'rejected' | 'asked_rest';
  note: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
  usedBefore: boolean;
}

export type RestrictedBlock = 'receipt_checks' | 'orders' | 'reports' | 'staff';
export interface PlatformSettings {
  trialEnabled: boolean;
  trialDays: number;
  reminderDays: number[];
  graceDays: number;
  restrictedDays: number;
  restrictedBlocks: RestrictedBlock[];
  priceNormalMonthly: number;
  priceNormalQuarterly: number;
  /** Missing from older servers (and the mock). */
  priceNormalMultiMonthly?: number;
  /** Restaurant app's Normal Verify (missing from older servers and the mock). */
  priceRestaurantNormalMonthly?: number;
  priceRestaurantNormalQuarterly?: number;
  priceRestaurantMonthly: number;
}
export interface SettingsPage {
  settings: PlatformSettings;
  exceptions: { businessId: string; name: string; reason: string | null }[];
  impact: { overdue: number; restricted: number };
  planCounts: {
    normal: number;
    normal_multi?: number;
    restaurant_normal?: number;
    restaurant: number;
  };
  payTo: {
    cbe: { name: string; last4: string } | null;
    telebirr: { name: string; last4: string } | null;
  };
  telegram: boolean;
}

export interface HealthPage {
  app: { p50: number | null; p95: number | null; samples: number };
  database: { ok: boolean; ms: number | null; sizeMb: number | null };
  server: { uptimeSeconds: number; memoryMb: number; memoryPercent: number; node: string };
  banks: BankSite[];
  reading: {
    geminiCalls: number;
    rateLimited: number;
    ocrFallback: number;
    geminiConfigured: boolean;
  };
  errors: {
    id: string;
    area: string;
    cause: string;
    route: string | null;
    count: number;
    firstSeen: string;
    lastSeen: string;
    resolvedAt: string | null;
  }[];
}

export interface Announcement {
  id: string;
  bodyEn: string;
  bodyAm: string;
  audience: 'all' | 'plan' | 'city';
  plan: PlanCode | null;
  city: string | null;
  showFrom: string;
  hideOn: string;
  createdBy: string;
  state: 'showing' | 'scheduled' | 'ended';
}
export interface NewAnnouncement {
  bodyEn: string;
  bodyAm: string;
  audience: 'all' | 'plan' | 'city';
  plan?: PlanCode;
  city?: string;
  showFrom: string;
  hideOn: string;
}

const qs = (q: CustomerQuery) => ({
  search: q.search || undefined,
  plan: q.plan,
  city: q.city || undefined,
  filter: q.filter,
  page: q.page ? String(q.page) : undefined,
});

export const getDashboard = () => call<Dashboard>('/admin/dashboard');
export const getCustomers = (q: CustomerQuery) =>
  call<CustomerList>('/admin/customers', { query: qs(q) });
export const getCustomer = (id: string) =>
  call<CustomerDetail>(`/admin/customers/${encodeURIComponent(id)}`);

const customerAction = (id: string, action: string, body: object) =>
  call<void>(`/admin/customers/${encodeURIComponent(id)}/${action}`, { method: 'POST', body });
export const extendCustomer = (id: string, days: number, note?: string) =>
  customerAction(id, 'extend', { days, note });
export const markCustomerPaid = (id: string, plan: PlanCode, period: string, note?: string) =>
  customerAction(id, 'mark-paid', { plan, period, note });
export const suspendCustomer = (id: string, suspended: boolean, note?: string) =>
  customerAction(id, 'suspend', { suspended, note });
export const changeCustomerPlan = (id: string, plan: PlanCode) =>
  customerAction(id, 'plan', { plan });
export const exemptCustomer = (id: string, exempt: boolean, reason?: string) =>
  customerAction(id, 'exempt', { exempt, reason });
export const addCustomerNote = (id: string, text: string) => customerAction(id, 'notes', { text });

export const getReviews = (status: 'pending' | 'approved' | 'rejected') =>
  call<{ pending: number; items: PaymentReviewItem[] }>('/admin/reviews', { query: { status } });
export const decideReview = (
  id: string,
  decision: 'approve' | 'reject' | 'ask_rest',
  note?: string
) =>
  call<void>(`/admin/reviews/${encodeURIComponent(id)}/decide`, {
    method: 'POST',
    body: { decision, note },
  });

export const getSettingsPage = () => call<SettingsPage>('/admin/settings');
export const saveSettings = (settings: PlatformSettings) =>
  call<PlatformSettings>('/admin/settings', { method: 'PUT', body: settings });

export const getHealth = (recheck = false) =>
  call<HealthPage>('/admin/health', { query: { recheck: recheck ? 'true' : undefined } });
export const resolveError = (id: string) =>
  call<void>(`/admin/errors/${encodeURIComponent(id)}/resolve`, { method: 'POST' });
export const sendTestAlert = () =>
  call<{ sent: boolean }>('/admin/alerts/test', { method: 'POST' });

export const getAnnouncements = () => call<Announcement[]>('/admin/announcements');
export const createAnnouncement = (a: NewAnnouncement) =>
  call<void>('/admin/announcements', { method: 'POST', body: a });
export const endAnnouncement = (id: string) =>
  call<void>(`/admin/announcements/${encodeURIComponent(id)}/end`, { method: 'POST' });

export const setIdleTimeout = (idleTimeoutMinutes: 30 | 120 | 480) =>
  call<void>('/admin/me', { method: 'PATCH', body: { idleTimeoutMinutes } });
export const getOtherSessions = () => call<{ others: number }>('/admin/sessions');
export const signOutOtherSessions = () =>
  call<void>('/admin/sessions/sign-out-others', { method: 'POST' });

/** Downloads a CSV export in the browser (the token goes in a header, never the URL). */
export async function downloadCsv(kind: 'customers' | 'activity', q: CustomerQuery = {}) {
  const params = new URLSearchParams(
    Object.entries(qs(q)).filter((e): e is [string, string] => e[1] !== undefined)
  ).toString();
  const token = currentAdminToken();
  const res = await fetch(`${API_BASE_URL}/admin/${kind}.csv${params ? `?${params}` : ''}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`export failed (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = `${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
