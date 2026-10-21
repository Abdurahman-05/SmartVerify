import fastifyRateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyServerOptions } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { z } from 'zod';

import type { Env } from './config/env.js';
import { adminRoutes } from './modules/admin/admin.routes.js';
import { authRoutes, publicAuthRoutes } from './modules/auth/auth.routes.js';
import { bankAccountRoutes } from './modules/bank-accounts/bank-account.routes.js';
import { verificationRoutes } from './modules/verification/verification.routes.js';
import { billRoutes } from './modules/bills/bill.routes.js';
import { feeRoutes } from './modules/fees/fee.routes.js';
import { historyRoutes } from './modules/history/history.routes.js';
import { kitchenRoutes } from './modules/kitchen/kitchen.routes.js';
import { overviewRoutes } from './modules/overview/overview.routes.js';
import { paymentRoutes } from './modules/payments/payment.routes.js';
import { tipRoutes } from './modules/tips/tip.routes.js';
import { menuRoutes } from './modules/menu/menu.routes.js';
import { orderRoutes } from './modules/orders/order.routes.js';
import { subscriptionRoutes } from './modules/subscriptions/subscription.routes.js';
import { tableRoutes } from './modules/tables/table.routes.js';
import authPlugin from './plugins/auth.js';
import errorsPlugin from './plugins/errors.js';
import prismaPlugin from './plugins/prisma.js';
import swaggerPlugin from './plugins/swagger.js';
import { AppError } from './shared/errors/app-error.js';

declare module 'fastify' {
  interface FastifyInstance {
    env: Env;
  }
}

export interface BuildAppOptions {
  env: Env;
  logger?: FastifyServerOptions['logger'];
}

export async function buildApp({ env, logger }: BuildAppOptions) {
  const app = Fastify({
    logger: logger ?? {
      level: env.LOG_LEVEL,
      // Never log tokens. PINs are not logged because request bodies are not logged.
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
    bodyLimit: 1_048_576,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('env', env);

  await app.register(errorsPlugin);

  // Browsers (the admin console on the web) may call the API only from the listed origins.
  // Bearer tokens, no cookies: credentials are never allowed.
  const webOrigins = new Set(
    env.WEB_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean)
  );
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (!origin || !webOrigins.has(origin)) return;
    reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Vary', 'Origin');
    if (request.method === 'OPTIONS') {
      reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
      reply.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key');
      reply.header('Access-Control-Max-Age', '600');
      return reply.status(204).send();
    }
  });
  await app.register(fastifyRateLimit, {
    max: 300,
    timeWindow: '1 minute',
    hook: 'preHandler',
    errorResponseBuilder: () => new AppError('RATE_LIMITED'),
  });
  await app.register(prismaPlugin, { databaseUrl: env.DATABASE_URL });
  await app.register(authPlugin);
  await app.register(swaggerPlugin);

  await app.register(
    async (api) => {
      api.withTypeProvider<ZodTypeProvider>().get(
        '/health',
        {
          schema: {
            tags: ['health'],
            response: {
              200: z.object({ status: z.literal('ok'), database: z.literal('ok') }),
              503: z.object({ status: z.literal('degraded'), database: z.literal('error') }),
            },
          },
        },
        async (_request, reply) => {
          try {
            await api.prisma.$queryRaw`SELECT 1`;
            return { status: 'ok' as const, database: 'ok' as const };
          } catch {
            return reply.status(503).send({ status: 'degraded', database: 'error' });
          }
        }
      );

      await api.register(publicAuthRoutes);
      // The Smart Verify team's admin: its own accounts and sessions (not business tokens).
      await api.register(adminRoutes);

      // Everything below requires a valid, non-revoked session.
      await api.register(async (secured) => {
        secured.addHook('onRequest', secured.authenticate);
        await secured.register(authRoutes);
        await secured.register(subscriptionRoutes);
        await secured.register(bankAccountRoutes);
        await secured.register(verificationRoutes);
        // Restaurant Plus (each module requires the restaurant plan).
        await secured.register(orderRoutes);
        await secured.register(billRoutes);
        await secured.register(tableRoutes);
        await secured.register(menuRoutes);
        await secured.register(feeRoutes);
        await secured.register(kitchenRoutes);
        await secured.register(paymentRoutes);
        await secured.register(tipRoutes);
        await secured.register(overviewRoutes);
        await secured.register(historyRoutes);
      });
    },
    { prefix: '/api/v1' }
  );

  return app;
}
