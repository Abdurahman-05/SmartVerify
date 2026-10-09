import { buildApp } from '../app.js';
import { loadEnv } from '../config/env.js';
import type { VerificationProvider } from '../modules/verification/verification.types.js';

export type TestApp = Awaited<ReturnType<typeof buildApp>>;

export async function createTestApp(
  options: { env?: Record<string, string>; providers?: VerificationProvider[] } = {}
) {
  const env = loadEnv({ ...process.env, ...options.env });
  const app = await buildApp({
    env,
    verificationProviders: options.providers ?? [],
    logger: false,
  });
  await app.ready();
  return app;
}

/** Empties every table between tests. */
export async function resetDatabase(app: TestApp) {
  const tables = await app.prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  if (list) await app.prisma.$executeRawUnsafe(`TRUNCATE ${list} CASCADE`);
}

let phoneCounter = 0;
/** Unique valid phone numbers (9 digits starting with 9). */
export const nextPhone = () => `9${String(10_000_000 + ++phoneCounter).padStart(8, '0')}`;

export async function registerOwner(app: TestApp, overrides: Partial<Record<string, string>> = {}) {
  const body = {
    fullName: 'Abebe Test',
    businessName: 'Test Cafe',
    phone: nextPhone(),
    pin: '123456',
    ...overrides,
  };
  const res = await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: body });
  if (res.statusCode !== 201) throw new Error(`register failed: ${res.statusCode} ${res.body}`);
  const json = res.json() as { token: string; user: { userId: string } };
  return { ...body, token: json.token, userId: json.user.userId };
}

export const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

export async function addStaff(
  app: TestApp,
  token: string,
  body: { role: 'manager' | 'waiter' | 'chef'; pin?: string; phone?: string; name?: string }
) {
  const payload = { name: 'Staff Person', phone: nextPhone(), pin: '1111', ...body };
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/staff',
    headers: bearer(token),
    payload,
  });
  return { res, payload };
}

export async function signIn(app: TestApp, phone: string, pin: string) {
  return app.inject({ method: 'POST', url: '/api/v1/auth/sign-in', payload: { phone, pin } });
}
