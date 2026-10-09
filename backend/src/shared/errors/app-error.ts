/** Machine-readable error codes. The app translates them; the API never sends sentences. */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'WRONG_CREDENTIALS'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'PHONE_TAKEN'
  | 'ACCOUNT_DUPLICATE'
  | 'ACCOUNT_LIMIT'
  | 'SUBSCRIPTION_REQUIRED'
  | 'PAYMENT_NOT_CONFIGURED'
  | 'RATE_LIMITED'
  | 'CONFLICT'
  | 'INTERNAL_ERROR';

const statusByCode: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  WRONG_CREDENTIALS: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  PHONE_TAKEN: 409,
  ACCOUNT_DUPLICATE: 409,
  ACCOUNT_LIMIT: 409,
  CONFLICT: 409,
  SUBSCRIPTION_REQUIRED: 402,
  PAYMENT_NOT_CONFIGURED: 501,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly statusCode: number;

  constructor(
    readonly code: ErrorCode,
    readonly details?: Record<string, unknown>
  ) {
    super(code);
    this.name = 'AppError';
    this.statusCode = statusByCode[code];
  }
}

export interface ErrorBody {
  error: { code: ErrorCode; details?: Record<string, unknown> };
}

export const errorBody = (code: ErrorCode, details?: Record<string, unknown>): ErrorBody => ({
  error: details ? { code, details } : { code },
});
