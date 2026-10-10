import { PrismaPg } from '@prisma/adapter-pg';
import fp from 'fastify-plugin';

import { PrismaClient } from '../generated/prisma/client.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

/** Postgres schema from the URL's `?schema=` (Prisma convention), e.g. the test schema. */
export const schemaFromUrl = (databaseUrl: string) =>
  new URL(databaseUrl).searchParams.get('schema') ?? undefined;

export function createPrismaClient(databaseUrl: string) {
  const url = new URL(databaseUrl);
  const schema = schemaFromUrl(databaseUrl);
  // `schema` is a Prisma setting, not a Postgres one: pass it to the adapter, not to the driver.
  url.searchParams.delete('schema');
  const adapter = new PrismaPg(
    { connectionString: url.toString() },
    schema ? { schema } : undefined
  );
  return new PrismaClient({ adapter });
}

export default fp<{ databaseUrl: string }>(
  async (app, { databaseUrl }) => {
    const prisma = createPrismaClient(databaseUrl);
    await prisma.$connect();
    app.decorate('prisma', prisma);
    app.addHook('onClose', async () => {
      await prisma.$disconnect();
    });
  },
  { name: 'prisma' }
);
