import * as real from '@/lib/api/admin';
import * as mock from '@/lib/mock/admin';

/** EXPO_PUBLIC_USE_MOCK_ADMIN=true uses the offline mock; default is the real backend. */
export const USE_MOCK_ADMIN = process.env.EXPO_PUBLIC_USE_MOCK_ADMIN === 'true';

export type { ActivityCategory, ActivityItem, AdminProfile } from '@/lib/api/admin';

const impl = USE_MOCK_ADMIN ? mock : real;

export const adminSignIn = impl.adminSignIn;
export const startTwoStepSetup = impl.startTwoStepSetup;
export const confirmTwoStepSetup = impl.confirmTwoStepSetup;
export const verifyTwoStep = impl.verifyTwoStep;
export const adminSignOut = impl.adminSignOut;
export const hasAdminToken = impl.hasAdminToken;
export const getAdminProfile = impl.getAdminProfile;
export const getActivity = impl.getActivity;
