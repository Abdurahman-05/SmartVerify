import { buildApp } from '../app.js';
import { loadEnv } from '../config/env.js';

export type TestApp = Awaited<ReturnType<typeof buildApp>>;

export async function createTestApp(options: { env?: Record<string, string> } = {}) {
  const env = loadEnv({ ...process.env, ...options.env });
  const app = await buildApp({ env, logger: false });
  await app.ready();
  return app;
}
