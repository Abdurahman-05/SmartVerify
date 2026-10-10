import type { FastifyError } from 'fastify';
import fp from 'fastify-plugin';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';

import { AppError, errorBody } from '../shared/errors/app-error.js';

/** One consistent error shape. Stack traces and database details never reach the client. */
export default fp(
  async (app) => {
    app.setErrorHandler((error: FastifyError | AppError, request, reply) => {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send(errorBody(error.code, error.details));
      }

      if (hasZodFastifySchemaValidationErrors(error)) {
        const issues = error.validation.map((v) => ({ path: v.instancePath, code: v.keyword }));
        return reply.status(400).send(errorBody('VALIDATION_ERROR', { issues }));
      }

      if (error.statusCode === 429) {
        return reply.status(429).send(errorBody('RATE_LIMITED'));
      }

      // Malformed JSON, wrong content type, body too large, etc.
      if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
        return reply.status(400).send(errorBody('VALIDATION_ERROR'));
      }

      request.log.error({ err: error }, 'unhandled error');
      return reply.status(500).send(errorBody('INTERNAL_ERROR'));
    });

    app.setNotFoundHandler((_request, reply) => reply.status(404).send(errorBody('NOT_FOUND')));
  },
  { name: 'errors' }
);
