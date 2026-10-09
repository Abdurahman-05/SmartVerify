import Constants from 'expo-constants';

/**
 * Typed HTTP client for the Smart Verify backend (backend/). The mocks in src/lib/mock stay in use;
 * switch one mock module at a time to call `api(...)` with the same input/output shapes.
 *
 * Base URL, in order:
 *  1. EXPO_PUBLIC_API_URL (e.g. http://192.168.1.20:3000/api/v1) — always wins.
 *  2. In development, the IP of the computer running Metro (from Expo's hostUri) + :3000.
 *     Works for a phone on the same Wi-Fi and for emulators, without hardcoding localhost.
 */
const API_PORT = 3000;

function resolveBaseUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:${API_PORT}/api/v1`;
}

export const API_BASE_URL = resolveBaseUrl();

/** Error codes from the backend (backend/src/shared/errors/app-error.ts), translated in the app. */
export type ApiErrorCode =
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
  | 'INTERNAL_ERROR'
  | 'NETWORK_ERROR';

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly status: number,
    readonly details?: Record<string, unknown>
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

let authToken: string | null = null;

/** Set after sign-in, cleared on sign-out. Keep it in memory or SecureStore, never in plain storage. */
export const setAuthToken = (token: string | null) => {
  authToken = token;
};

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | undefined>;
  /** Send the same key when retrying, so the server does not create duplicates. */
  idempotencyKey?: string;
  timeoutMs?: number;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, idempotencyKey, timeoutMs = 15_000 } = options;
  const params = new URLSearchParams(
    Object.entries(query ?? {}).filter((e): e is [string, string] => e[1] !== undefined)
  ).toString();
  const url = `${API_BASE_URL}${path}${params ? `?${params}` : ''}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(authToken && { Authorization: `Bearer ${authToken}` }),
        ...(idempotencyKey && { 'Idempotency-Key': idempotencyKey }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', 0);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) return undefined as T;
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const error = json?.error;
    throw new ApiError(error?.code ?? 'INTERNAL_ERROR', response.status, error?.details);
  }
  return json as T;
}
