import 'dotenv/config';
import { z } from 'zod';

// Only DATABASE_URL is required. Everything else has a safe default; add a variable to .env only to change it.
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.url(),
  /**
   * Start subscriptions without payment (no payment provider yet). Allowed by default outside
   * production; in production it must be switched on explicitly.
   */
  ALLOW_UNPAID_SUBSCRIPTIONS: z.enum(['true', 'false']).optional(),
  /**
   * Accept bank amounts reported by the app (fake bank check) for restaurant payments, until bank
   * verification is built. Allowed by default outside production; never on in production unless set.
   */
  ALLOW_UNVERIFIED_BANK_PAYMENTS: z.enum(['true', 'false']).optional(),
  /** 'false' skips TLS certificate checks on CBE receipt links. Dev only: ignored in production. */
  CBE_TLS_STRICT: z.enum(['true', 'false']).default('true'),
  /** A CBE receipt older than this is EXPIRED. */
  CBE_RECEIPT_MAX_AGE_HOURS: z.coerce.number().int().positive().default(24),
  /** A plan-payment receipt older than this is EXPIRED (default 1 week). */
  SUBSCRIPTION_RECEIPT_MAX_AGE_HOURS: z.coerce.number().int().positive().default(168),
  /**
   * Smart Verify's own CBE account that receives subscription payments (full number) and its
   * holder name as CBE shows it. Without them, paying for a plan is not available.
   */
  SUBSCRIPTION_CBE_ACCOUNT: z
    .string()
    .regex(/^\d{13}$/)
    .optional(),
  SUBSCRIPTION_CBE_NAME: z.string().min(3).optional(),
  /** Smart Verify's telebirr number (09… / 07…) and name, a second way to pay for plans. */
  SUBSCRIPTION_TELEBIRR: z
    .string()
    .regex(/^0[79]\d{8}$/)
    .optional(),
  SUBSCRIPTION_TELEBIRR_NAME: z.string().min(3).optional(),
  /** Google Gemini API key, for reading receipt pictures. Server only: never sent to the app. */
  /** Admin: 32 random bytes, base64 (`openssl rand -base64 32`). Encrypts authenticator secrets. */
  ADMIN_SECRET_KEY: z.string().min(40).optional(),
  /** Web pages allowed to call the API from a browser (the admin console), comma-separated. */
  /** Alerts to the team (a Telegram bot and the chat it posts to). */
  TELEGRAM_BOT_TOKEN: z.string().min(20).optional(),
  TELEGRAM_CHAT_ID: z.string().min(1).optional(),
  WEB_ORIGINS: z.string().default('http://localhost:8082'),
  GEMINI_API_KEY: z.string().min(10).optional(),
  /** Optional key per bank (each from its own Google project, so each has its own rate limit). */
  GEMINI_API_KEY_CBE: z.string().min(10).optional(),
  GEMINI_API_KEY_TEL: z.string().min(10).optional(),
  GEMINI_API_KEY_DAS: z.string().min(10).optional(),
  GEMINI_API_KEY_BOA: z.string().min(10).optional(),
  GEMINI_API_KEY_MPE: z.string().min(10).optional(),
  GEMINI_API_KEY_EBR: z.string().min(10).optional(),
  /** Gemini model for reading pictures: fast and accurate on receipts (change when retired). */
  GEMINI_MODEL: z.string().min(1).default('gemini-3.5-flash-lite'),
  /** DEVELOPMENT: Unlimited-OCR's OpenAI-compatible API (vLLM/Ollama), e.g. http://host:8000/v1. */
  UNLIMITED_OCR_URL: z.string().url().optional(),
  UNLIMITED_OCR_MODEL: z.string().min(1).default('baidu/Unlimited-OCR'),
  UNLIMITED_OCR_API_KEY: z.string().min(1).optional(),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    // Only variable names and rules are printed, never values.
    const problems = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return parsed.data;
}

/** The Gemini key for this bank's pictures: its own key if set, else the shared GEMINI_API_KEY. */
export function geminiKeyFor(
  env: Env,
  bank: 'CBE' | 'TEL' | 'DAS' | 'BOA' | 'MPE' | 'EBR' | 'AUTO'
): string | undefined {
  // AUTO (bank not known yet) uses the main key.
  return (bank === 'AUTO' ? undefined : env[`GEMINI_API_KEY_${bank}`]) ?? env.GEMINI_API_KEY;
}
