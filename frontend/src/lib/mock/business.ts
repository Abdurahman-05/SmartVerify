import type { BusinessAccess, BusinessAnnouncement, BusinessProfile } from '@/lib/api/business';

import { mockDelay } from './mock';

/** Offline: an active business, no announcements; the profile lives in memory. */
let profile: BusinessProfile = {
  name: 'Offline Cafe',
  businessType: null,
  city: null,
  address: null,
  latitude: null,
  longitude: null,
};

export async function getBusinessAccess(): Promise<BusinessAccess> {
  await mockDelay(150);
  return {
    status: 'active',
    endsAt: null,
    daysLeft: null,
    nextStepAt: null,
    remind: false,
    suspendedByAdmin: false,
    blocked: [],
  };
}

export async function getBusinessProfile(): Promise<BusinessProfile> {
  await mockDelay(150);
  return profile;
}

export async function updateBusinessProfile(input: {
  businessType?: string | null;
  city?: string | null;
  address?: string | null;
  location?: string;
}): Promise<BusinessProfile> {
  await mockDelay(300);
  const m = /(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/.exec(input.location ?? '');
  profile = {
    ...profile,
    businessType: input.businessType ?? null,
    city: input.city ?? null,
    address: input.address ?? null,
    latitude: m ? Number(m[1]) : profile.latitude,
    longitude: m ? Number(m[2]) : profile.longitude,
  };
  return profile;
}

export async function getBusinessAnnouncements(): Promise<BusinessAnnouncement[]> {
  await mockDelay(150);
  return [];
}
