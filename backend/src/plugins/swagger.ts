import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fp from 'fastify-plugin';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';

export default fp(
  async (app) => {
    await app.register(fastifySwagger, {
      openapi: {
        info: {
          title: 'Smart Verify API',
          description:
            'Backend for the Smart Verify app. Money is integer ETB; errors are `{ error: { code } }`.',
          version: '0.1.0',
        },
        components: {
          securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
        },
      },
      transform: jsonSchemaTransform,
    });
    await app.register(fastifySwaggerUi, { routePrefix: '/docs' });
  },
  { name: 'swagger' }
);
