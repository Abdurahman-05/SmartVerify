/** Machine-readable error codes. The app translates them; the API never sends sentences. */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

const statusByCode: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
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
