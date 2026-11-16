import * as real from '@/lib/api/business';
import * as mock from '@/lib/mock/business';

/** EXPO_PUBLIC_USE_MOCK_BUSINESS=true uses the offline mock; default is the real backend. */
export const USE_MOCK_BUSINESS = process.env.EXPO_PUBLIC_USE_MOCK_BUSINESS === 'true';

export type {
  BusinessAccess,
  BusinessAnnouncement,
  BusinessLocation,
  BusinessLocationInput,
  BusinessProfile,
} from '@/lib/api/business';

const impl = USE_MOCK_BUSINESS ? mock : real;

export const getBusinessAccess = impl.getBusinessAccess;
export const getBusinessProfile = impl.getBusinessProfile;
export const updateBusinessProfile = impl.updateBusinessProfile;
export const getBusinessAnnouncements = impl.getBusinessAnnouncements;
export const getBusinessLocation = impl.getBusinessLocation;
export const updateBusinessLocation = impl.updateBusinessLocation;
