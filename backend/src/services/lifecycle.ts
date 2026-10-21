import type { PlatformSettings } from '../generated/prisma/client.js';

const DAY_MS = 24 * 60 * 60_000;

/**
 * Where a business is in the payment lifecycle:
 *   trial / active → (end passes) grace → restricted → suspended.
 * A valid payment at any step puts it back to active. Exempt businesses are never restricted.
 */
export type AccessStatus = 'trial' | 'active' | 'grace' | 'restricted' | 'suspended';

export interface AccessInfo {
  status: AccessStatus;
  /** When the paid period or the trial ends (or ended). Null: never had either. */
  endsAt: Date | null;
  /** Whole days left (≥ 0) before the end; negative: days overdue. */
  daysLeft: number | null;
  /** When the next step starts (grace → restricted → suspended), if one is coming. */
  nextStepAt: Date | null;
  /** The admin suspended it by hand. */
  suspendedByAdmin: boolean;
  exempt: boolean;
  /** Show the "pay soon" reminder (a reminder day was reached). */
  remind: boolean;
}

export interface LifecycleInput {
  createdAt: Date;
  suspendedAt: Date | null;
  exemptFromRules: boolean;
  /** The latest subscription (any status but cancelled-by-replacement). */
  latest: { endsAt: Date; paymentMethod: string | null } | null;
}

export function accessOf(
  business: LifecycleInput,
  settings: PlatformSettings,
  now = new Date()
): AccessInfo {
  const exempt = business.exemptFromRules;
  const trialEnd = settings.trialEnabled
    ? new Date(business.createdAt.getTime() + settings.trialDays * DAY_MS)
    : business.createdAt;
  // A paid (or admin-given) period wins over the trial; a trial subscription counts as trial.
  const endsAt = business.latest?.endsAt ?? (settings.trialEnabled ? trialEnd : null);
  const onTrial = business.latest ? business.latest.paymentMethod === 'trial' : true;
  const daysLeft = endsAt ? Math.ceil((endsAt.getTime() - now.getTime()) / DAY_MS) : null;
  const base = { endsAt, daysLeft, exempt, suspendedByAdmin: false, remind: false };

  if (business.suspendedAt) {
    return { ...base, status: 'suspended', nextStepAt: null, suspendedByAdmin: true };
  }
  const end = endsAt ?? business.createdAt;
  if (end > now) {
    const remind = daysLeft !== null && settings.reminderDays.some((d) => daysLeft <= d);
    return { ...base, status: onTrial ? 'trial' : 'active', nextStepAt: end, remind };
  }
  if (exempt) return { ...base, status: 'active', nextStepAt: null };

  const graceEnd = new Date(end.getTime() + settings.graceDays * DAY_MS);
  const restrictedEnd = new Date(graceEnd.getTime() + settings.restrictedDays * DAY_MS);
  if (now < graceEnd) return { ...base, status: 'grace', nextStepAt: graceEnd, remind: true };
  if (now < restrictedEnd) {
    return { ...base, status: 'restricted', nextStepAt: restrictedEnd, remind: true };
  }
  return { ...base, status: 'suspended', nextStepAt: null, remind: true };
}

/** What each "Restricted blocks" choice covers in the business API. */
export const RESTRICTED_BLOCKS = ['receipt_checks', 'orders', 'reports', 'staff'] as const;
export type RestrictedBlock = (typeof RESTRICTED_BLOCKS)[number];

/**
 * Which block a request falls under, or null. Viewing history is never blocked; suspended
 * businesses can still sign in, see who they are, pay and read announcements.
 */
export function blockOf(method: string, url: string): RestrictedBlock | null {
  const path = url.split('?')[0] ?? '';
  if (method === 'POST' && /^\/api\/v1\/verify\//.test(path)) return 'receipt_checks';
  if (method !== 'GET' && /^\/api\/v1\/(orders|bills|kitchen)/.test(path)) return 'orders';
  if (method === 'GET' && /^\/api\/v1\/(reports|overview)/.test(path)) return 'reports';
  if (method !== 'GET' && /^\/api\/v1\/staff/.test(path)) return 'staff';
  return null;
}

/** Always open, even when suspended: sign-in state, paying, the plan page, announcements. */
export const alwaysOpen = (method: string, url: string) => {
  const path = url.split('?')[0] ?? '';
  return (
    /^\/api\/v1\/auth\//.test(path) ||
    /^\/api\/v1\/subscription(\/|$)/.test(path) ||
    /^\/api\/v1\/business\/(access|profile|plan)$/.test(path) ||
    /^\/api\/v1\/announcements$/.test(path) ||
    (method === 'GET' && /^\/api\/v1\/(history|payments|transactions)/.test(path))
  );
};
