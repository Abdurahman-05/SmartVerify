import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Used only by the Prisma CLI (migrations). Migrations take a session lock, which a pooler
    // (Neon "-pooler" host) can leave stuck, so they use the direct URL when one is set.
    // The running app uses DATABASE_URL (pooled) through the driver adapter.
    url: process.env['DIRECT_DATABASE_URL'] ?? process.env['DATABASE_URL'],
  },
});
