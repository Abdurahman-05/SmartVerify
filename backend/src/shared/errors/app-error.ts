/** Machine-readable error codes. The app translates them; the API never sends sentences. */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'WRONG_CREDENTIALS'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'PHONE_TAKEN'
  | 'SUBSCRIPTION_REQUIRED'
  | 'TABLE_BUSY'
  | 'ITEM_UNAVAILABLE'
  | 'BILL_CLOSED'
  | 'MENU_DUPLICATE'
  | 'ACCOUNT_DUPLICATE'
  | 'ACCOUNT_LIMIT'
  | 'PAYMENT_NOT_CONFIGURED'
  | 'RECEIPT_USED'
  | 'INVALID_URL'
  | 'CONFLICT'
  | 'WRONG_CODE'
  | 'ACCOUNT_LOCKED'
  | 'ADMIN_NOT_CONFIGURED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

const statusByCode: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  WRONG_CREDENTIALS: 401,
  SUBSCRIPTION_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  PHONE_TAKEN: 409,
  /** Dine-in table already has an open bill. */
  TABLE_BUSY: 409,
  /** A menu item is missing, inactive or from another business. */
  ITEM_UNAVAILABLE: 409,
  /** The bill is already paid. */
  BILL_CLOSED: 409,
  /** The business already has a menu item with this name (ignoring case and spaces). */
  MENU_DUPLICATE: 409,
  /** This bank account is already connected. */
  ACCOUNT_DUPLICATE: 409,
  /** The business already has the most receiving accounts allowed. */
  ACCOUNT_LIMIT: 409,
  /** Paid subscriptions are not available yet (no payment provider). */
  PAYMENT_NOT_CONFIGURED: 501,
  /** This receipt already paid for a subscription. */
  RECEIPT_USED: 409,
  /** Not a receipt link we accept (wrong scheme, host or receipt id). */
  INVALID_URL: 400,
  /** Already decided or changed by someone else. */
  CONFLICT: 409,
  /** Wrong two-step code (details.triesLeft). */
  WRONG_CODE: 401,
  /** Too many wrong tries: locked for a while (details.until). */
  ACCOUNT_LOCKED: 423,
  /** ADMIN_SECRET_KEY is not set on the server. */
  ADMIN_NOT_CONFIGURED: 501,
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
