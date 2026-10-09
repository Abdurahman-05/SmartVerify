import 'dotenv/config';
import { z } from 'zod';

const bool = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z.url(),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
    SESSION_REMEMBER_TTL_DAYS: z.coerce.number().int().positive().default(30),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:8081')
      .transform((v) =>
        v
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean)
      ),
    BUSINESS_TIMEZONE: z.string().default('Africa/Addis_Ababa'),
    ALLOW_UNPAID_SUBSCRIPTIONS: bool,
    SIGN_IN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    SIGN_IN_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
    REGISTER_MAX_PER_HOUR: z.coerce.number().int().positive().default(10),
  })
  .refine((env) => !(env.NODE_ENV === 'production' && env.ALLOW_UNPAID_SUBSCRIPTIONS), {
    message: 'ALLOW_UNPAID_SUBSCRIPTIONS must be false in production',
    path: ['ALLOW_UNPAID_SUBSCRIPTIONS'],
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
