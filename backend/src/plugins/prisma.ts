import { PrismaPg } from '@prisma/adapter-pg';
import fp from 'fastify-plugin';

import { PrismaClient } from '../generated/prisma/client.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export const createPrismaClient = (databaseUrl: string) =>
  new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

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
