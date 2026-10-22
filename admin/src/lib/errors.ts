import { ApiError, type ApiErrorCode } from '@/lib/api/client';

/** Backend error codes -> i18n keys (en + am). Anything unknown shows the generic message. */
const keyByCode: Partial<Record<ApiErrorCode, string>> = {
  VALIDATION_ERROR: 'errors.validation',
  RATE_LIMITED: 'errors.rateLimited',
  NETWORK_ERROR: 'errors.noConnection',
  RECEIPT_USED: 'errors.receiptUsed',
  WRONG_CODE: 'platformAdmin.errors.wrongCode',
  ACCOUNT_LOCKED: 'platformAdmin.errors.locked',
  ADMIN_NOT_CONFIGURED: 'platformAdmin.errors.notConfigured',
};

export function errorMessageKey(error: unknown): string {
  if (error instanceof ApiError) return keyByCode[error.code] ?? 'common.somethingWrong';
  return 'common.somethingWrong';
}

export const isNetworkError = (error: unknown) =>
  error instanceof ApiError && error.code === 'NETWORK_ERROR';
