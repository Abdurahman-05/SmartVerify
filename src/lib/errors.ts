import { ApiError, type ApiErrorCode } from '@/lib/api/client';
import { WrongCredentialsError } from '@/lib/mock/auth';

/** Backend error codes -> i18n keys (en + am). Anything unknown shows the generic message. */
const keyByCode: Partial<Record<ApiErrorCode, string>> = {
  WRONG_CREDENTIALS: 'auth.errors.wrongCredentials',
  PHONE_TAKEN: 'auth.errors.phoneTaken',
  VALIDATION_ERROR: 'errors.validation',
  RATE_LIMITED: 'errors.rateLimited',
  SUBSCRIPTION_REQUIRED: 'errors.subscriptionRequired',
  NETWORK_ERROR: 'errors.noConnection',
};

export function errorMessageKey(error: unknown): string {
  if (error instanceof WrongCredentialsError) return 'auth.errors.wrongCredentials';
  if (error instanceof ApiError) return keyByCode[error.code] ?? 'common.somethingWrong';
  return 'common.somethingWrong';
}

export const isNetworkError = (error: unknown) =>
  error instanceof ApiError && error.code === 'NETWORK_ERROR';
