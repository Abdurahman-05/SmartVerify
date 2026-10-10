import { execSync } from 'node:child_process';

import { testDatabaseUrl } from './test-database.js';

/** Applies pending migrations to the test schema (non-destructive; tests empty their own tables). */
export default function setup() {
  const { url } = testDatabaseUrl();
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    // Both, so the CLI can never fall back to the development database.
    env: { ...process.env, DATABASE_URL: url, DIRECT_DATABASE_URL: url },
  });
}
