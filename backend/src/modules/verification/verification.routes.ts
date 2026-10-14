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
import { closeOcr, findCbeReference, isImage, readImageText } from './ocr.js';
import { listFailedChecks, saveFailedCheck, verifyCbe } from './verification.service.js';

/** Each check fetches from the bank: keep it to a sane rate per user. */
const VERIFY_MAX_PER_MINUTE = 30;
/** Reading a picture is heavy (OCR). */
const READ_MAX_PER_MINUTE = 10;
/** Screenshot size after base64 decoding. */
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

/** Payment checks against bank receipts (both plans). Failed checks are kept for history. */
export const verificationRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onClose', closeOcr);

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
          'Reads the CBE receipt behind a QR link and checks it. CBE to CBE: receiver account ' +
          "last 4 is one of the business's CBE accounts and the receiver name matches its holder " +
          '(WRONG_RECEIVER_NAME). CBE to another bank (receiver "Inter Bank…"): the destination ' +
          'account in "Reason / Type of service" is the full number of one of its other-bank ' +
          'accounts. Both: amount ≥ expected, status success, not older than ' +
          'CBE_RECEIPT_MAX_AGE_HOURS. Answers verified / not_matching / ' +
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

  app.post(
    '/verify/read-reference',
    {
      preHandler: requireRoles('owner', 'manager', 'waiter'),
      // base64 makes a 6 MB picture about 8 MB of JSON.
      bodyLimit: 9 * 1024 * 1024,
      config: {
        rateLimit: {
          max: READ_MAX_PER_MINUTE,
          timeWindow: '1 minute',
          keyGenerator: (request) => `read:${request.headers.authorization ?? request.ip}`,
        },
      },
      schema: {
        tags: ['verification'],
        security: [{ bearerAuth: [] }],
        description:
          'Reads the CBE Transaction ID (FT + 10) from a receipt screenshot or photo (OCR on ' +
          'the server), plus all the text read. The picture and text are not stored or logged. ' +
          'reference is null when none was found.',
        body: z.object({
          image: z.string().min(16).max(9_000_000).describe('PNG / JPEG / WebP, base64'),
        }),
        response: {
          200: z.object({
            reference: z.string().nullable(),
            text: z.string().describe('All text read from the picture'),
          }),
          400: errorResponseSchema.describe('VALIDATION_ERROR (not a picture, or too big)'),
          401: errorResponseSchema.describe('UNAUTHORIZED'),
          403: errorResponseSchema.describe('FORBIDDEN'),
          429: errorResponseSchema.describe('RATE_LIMITED'),
        },
      },
    },
    async (request) => {
      const image = Buffer.from(request.body.image, 'base64');
      if (image.length > MAX_IMAGE_BYTES || !isImage(image)) {
        throw new AppError('VALIDATION_ERROR', { reason: 'image' });
      }
      const text = await readImageText(image);
      const reference = findCbeReference(text);
      request.log.info(
        { readReference: reference ? 'found' : 'not_found' },
        reference
          ? `Receipt picture: found ${reference}`
          : 'Receipt picture: no Transaction ID found'
      );
      return { reference, text };
    }
  );
};
