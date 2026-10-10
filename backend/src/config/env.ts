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
