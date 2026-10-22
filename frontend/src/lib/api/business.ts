import { api } from './client';

/** Where the business is in the payment lifecycle (decided by the server from the admin's rules). */
export interface BusinessAccess {
  status: 'trial' | 'active' | 'grace' | 'restricted' | 'suspended';
  endsAt: string | null;
  daysLeft: number | null;
  nextStepAt: string | null;
  remind: boolean;
  suspendedByAdmin: boolean;
  blocked: string[];
}

export interface BusinessProfile {
  name: string;
  businessType: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface BusinessAnnouncement {
  id: string;
  bodyEn: string;
  bodyAm: string;
}

/** GET /business/access — for the "pay now" banner. */
export const getBusinessAccess = () => api<BusinessAccess>('/business/access');

/** GET /business/profile — owner and manager. */
export const getBusinessProfile = () => api<BusinessProfile>('/business/profile');

/** PATCH /business/profile — owner. `location`: a Google Maps link or "lat, lng". */
export const updateBusinessProfile = (input: {
  businessType?: string | null;
  city?: string | null;
  address?: string | null;
  location?: string;
}) => api<BusinessProfile>('/business/profile', { method: 'PATCH', body: input });

/** GET /announcements — banners from the Smart Verify team. */
export const getBusinessAnnouncements = () => api<BusinessAnnouncement[]>('/announcements');
