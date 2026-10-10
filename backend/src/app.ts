import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyServerOptions } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { z } from 'zod';

import type { Env } from './config/env.js';
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
      // Never log tokens.
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
    bodyLimit: 1_048_576,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('env', env);

  await app.register(errorsPlugin);
  // CSP is off because this server returns JSON (and the Swagger UI page needs inline scripts).
  await app.register(fastifyHelmet, { contentSecurityPolicy: false });
  // Native apps do not send an Origin header; only the Expo web dev server needs CORS.
  await app.register(fastifyCors, { origin: env.CORS_ORIGINS });
  await app.register(fastifyRateLimit, {
    max: 300,
    timeWindow: '1 minute',
    hook: 'preHandler',
    errorResponseBuilder: () => new AppError('RATE_LIMITED'),
  });
  await app.register(prismaPlugin, { databaseUrl: env.DATABASE_URL });
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

      // Feature modules (src/modules/<name>) are registered here.
    },
    { prefix: '/api/v1' }
  );

  return app;
}
