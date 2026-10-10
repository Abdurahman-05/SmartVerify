import fastifyRateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyServerOptions } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { z } from 'zod';

import type { Env } from './config/env.js';
import { authRoutes, publicAuthRoutes } from './modules/auth/auth.routes.js';
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

      // Everything below requires a valid, non-revoked session.
      await api.register(async (secured) => {
        secured.addHook('onRequest', secured.authenticate);
        await secured.register(authRoutes);
      });
    },
    { prefix: '/api/v1' }
  );

  return app;
}
