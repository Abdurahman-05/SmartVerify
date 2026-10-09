import { execSync } from 'node:child_process';

import 'dotenv/config';

/** Applies any pending migrations to the test database (non-destructive; tests empty their own tables). */
export default function setup() {
  const url = process.env['TEST_DATABASE_URL'];
  if (!url) throw new Error('TEST_DATABASE_URL is not set (see backend/.env.example)');
  if (!/test/i.test(url)) throw new Error('TEST_DATABASE_URL must point at a test database');
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}
