import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { requireRoles } from '../../plugins/auth.js';
import { AppError } from '../../shared/errors/app-error.js';
import { errorResponseSchema } from '../../shared/schemas/common.js';
import { periodSchema, periodStart } from '../../shared/utils/period.js';
import {
  failedCheckSchema,
  verifyCbeBodySchema,
  verifyResponseSchema,
} from './verification.schemas.js';
import { listFailedChecks, saveFailedCheck, verifyCbe } from './verification.service.js';

/** Each check fetches from the bank: keep it to a sane rate per user. */
const VERIFY_MAX_PER_MINUTE = 30;

/** Payment checks against bank receipts (both plans). Failed checks are kept for history. */
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
          'unable_to_verify (all 200). A check that does not verify is saved (with billId, if ' +
          'given) and listed by GET /verify/failed. Duplicates are not checked yet.',
        body: verifyCbeBodySchema,
        response: {
          200: verifyResponseSchema,
          400: errorResponseSchema.describe('INVALID_URL | VALIDATION_ERROR'),
          401: errorResponseSchema.describe('UNAUTHORIZED'),
          403: errorResponseSchema.describe('FORBIDDEN'),
          404: errorResponseSchema.describe('NOT_FOUND (billId is not a bill of this business)'),
          429: errorResponseSchema.describe('RATE_LIMITED'),
        },
      },
    },
    async (request) => {
      const { businessId, memberId } = request.auth;
      const { url, expectedAmountEtb, billId } = request.body;
      if (billId) {
        const bill = await app.prisma.bill.findFirst({
          where: { id: billId, businessId },
          select: { id: true },
        });
        if (!bill) throw new AppError('NOT_FOUND');
      }

      const result = await verifyCbe(
        app.prisma,
        app.env,
        businessId,
        url,
        expectedAmountEtb,
        request.log
      );
      if (result.status !== 'verified') {
        await saveFailedCheck(app.prisma, {
          businessId,
          checkedById: memberId,
          billId,
          bankCode: 'CBE',
          expectedAmountEtb,
          result,
        });
      }
      return result;
    }
  );

  app.get(
    '/verify/failed',
    {
      preHandler: requireRoles('owner', 'manager', 'waiter'),
      schema: {
        tags: ['verification'],
        security: [{ bearerAuth: [] }],
        description:
          'Receipt checks that did not verify in the period (business days in Addis Ababa), ' +
          'newest first, at most 200. Waiters only get their own.',
        querystring: z.object({ period: periodSchema }),
        response: {
          200: z.array(failedCheckSchema),
          401: errorResponseSchema.describe('UNAUTHORIZED'),
          403: errorResponseSchema.describe('FORBIDDEN'),
        },
      },
    },
    async (request) => listFailedChecks(app.prisma, request.auth, periodStart(request.query.period))
  );
};
