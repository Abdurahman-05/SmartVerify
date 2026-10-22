import * as real from '@/lib/api/admin';
import * as realConsole from '@/lib/api/adminConsole';
import * as mock from '@/lib/mock/admin';
import * as mockConsole from '@/lib/mock/adminConsole';

/** EXPO_PUBLIC_USE_MOCK_ADMIN=true uses the offline mock; default is the real backend. */
export const USE_MOCK_ADMIN = process.env.EXPO_PUBLIC_USE_MOCK_ADMIN === 'true';

export type { ActivityCategory, ActivityItem, AdminProfile } from '@/lib/api/admin';
export type {
  AccessStatus,
  Announcement,
  BankSite,
  CustomerDetail,
  CustomerFilter,
  CustomerList,
  CustomerQuery,
  CustomerSummary,
  Dashboard,
  HealthPage,
  NewAnnouncement,
  PaymentReviewItem,
  PlanCode,
  PlatformSettings,
  RestrictedBlock,
  SettingsPage,
} from '@/lib/api/adminConsole';

const impl = USE_MOCK_ADMIN ? mock : real;
const data = USE_MOCK_ADMIN ? mockConsole : realConsole;

export const adminSignIn = impl.adminSignIn;
export const startTwoStepSetup = impl.startTwoStepSetup;
export const confirmTwoStepSetup = impl.confirmTwoStepSetup;
export const verifyTwoStep = impl.verifyTwoStep;
export const adminSignOut = impl.adminSignOut;
export const hasAdminToken = impl.hasAdminToken;
export const getAdminProfile = impl.getAdminProfile;
export const getActivity = impl.getActivity;

export const getDashboard = data.getDashboard;
export const getCustomers = data.getCustomers;
export const getCustomer = data.getCustomer;
export const extendCustomer = data.extendCustomer;
export const markCustomerPaid = data.markCustomerPaid;
export const suspendCustomer = data.suspendCustomer;
export const changeCustomerPlan = data.changeCustomerPlan;
export const exemptCustomer = data.exemptCustomer;
export const addCustomerNote = data.addCustomerNote;
export const getReviews = data.getReviews;
export const decideReview = data.decideReview;
export const getSettingsPage = data.getSettingsPage;
export const saveSettings = data.saveSettings;
export const getHealth = data.getHealth;
export const resolveError = data.resolveError;
export const sendTestAlert = data.sendTestAlert;
export const getAnnouncements = data.getAnnouncements;
export const createAnnouncement = data.createAnnouncement;
export const endAnnouncement = data.endAnnouncement;
export const setIdleTimeout = data.setIdleTimeout;
export const getOtherSessions = data.getOtherSessions;
export const signOutOtherSessions = data.signOutOtherSessions;
export const downloadCsv = data.downloadCsv;
