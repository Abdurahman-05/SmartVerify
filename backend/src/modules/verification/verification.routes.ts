import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { requireRoles } from '../../plugins/auth.js';
import { errorResponseSchema } from '../../shared/schemas/common.js';
import { verifyCbeBodySchema, verifyResponseSchema } from './verification.schemas.js';
import { verifyCbe } from './verification.service.js';

/** Each check fetches from the bank: keep it to a sane rate per user. */
const VERIFY_MAX_PER_MINUTE = 30;

/** Payment checks against bank receipts (both plans). Nothing is saved yet. */
export const verificationRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/verify/cbe',
    {
      preHandler: requireRoles('owner', 'manager', 'waiter'),
      config: {
        rateLimit: {
          max: VERIFY_MAX_PER_MINUTE,
          timeWindow: '1 minute',
          // Per signed-in user: all phones in a restaurant usually share one IP.
          keyGenerator: (request) => `verify:${request.headers.authorization ?? request.ip}`,
        },
      },
      schema: {
        tags: ['verification'],
        security: [{ bearerAuth: [] }],
        description:
          'Reads the CBE receipt behind a QR link and checks it: receiver is one of the ' +
          "business's CBE accounts (last 4 digits), amount ≥ expected, status success, and not " +
          'older than CBE_RECEIPT_MAX_AGE_HOURS. Answers verified / not_matching / ' +
          'unable_to_verify (all 200). Nothing is saved and duplicates are not checked yet.',
        body: verifyCbeBodySchema,
        response: {
          200: verifyResponseSchema,
          400: errorResponseSchema.describe('INVALID_URL | VALIDATION_ERROR'),
          401: errorResponseSchema.describe('UNAUTHORIZED'),
          403: errorResponseSchema.describe('FORBIDDEN'),
          429: errorResponseSchema.describe('RATE_LIMITED'),
        },
      },
    },
    async (request) =>
      verifyCbe(
        app.prisma,
        app.env,
        request.auth.businessId,
        request.body.url,
        request.body.expectedAmountEtb
      )
  );
};
