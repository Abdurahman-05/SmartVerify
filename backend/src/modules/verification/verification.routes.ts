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
import { GeminiError, readWithGemini } from './gemini.js';
import { closeOcr, findReference, imageType, readImageText, type PictureBank } from './ocr.js';
import {
  listFailedChecks,
  saveFailedCheck,
  BOA_RECEIPT_ID,
  DASHEN_REFERENCE,
  TELEBIRR_NUMBER,
  verifyBoa,
  verifyCbe,
  verifyDashen,
  verifyTelebirr,
} from './verification.service.js';

/** Each check fetches from the bank: keep it to a sane rate per user. */
const VERIFY_MAX_PER_MINUTE = 30;
/** Reading a picture is heavy (OCR). */
const READ_MAX_PER_MINUTE = 10;
/** Screenshot size after base64 decoding. */
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

/** Payment checks against bank receipts (both plans). Failed checks are kept for history. */
export const verificationRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onClose', closeOcr);

  /**
   * Reads a receipt picture: Gemini first (far better on photos of screens), retried once when
   * Google is busy (429 / 503); Tesseract OCR when there is no key or Gemini cannot answer.
   */
  async function readPicture(
    image: Buffer,
    type: string,
    bank: PictureBank,
    log: { warn: (obj: object, msg: string) => void }
  ): Promise<{ reference: string | null; text: string; source: 'gemini' | 'ocr' }> {
    const { GEMINI_API_KEY: apiKey, GEMINI_MODEL: model } = app.env;
    for (let attempt = 1; apiKey && attempt <= 2; attempt++) {
      try {
        const read = await readWithGemini(image, type, { apiKey, model }, bank);
        return { reference: read.reference, text: read.text, source: 'gemini' };
      } catch (error) {
        const reason = error instanceof GeminiError ? error.message : 'failed';
        log.warn({ gemini: reason, attempt }, `Gemini could not read the picture (${reason})`);
        if (!/^http (429|503)$/.test(reason)) break;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    const text = await readImageText(image);
    return { reference: findReference(bank, text), text, source: 'ocr' };
  }

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

  /** POST /verify/<bank>: check a receipt found by its reference (no QR), save failed tries. */
  const referenceCheck = (config: {
    path: string;
    bankCode: string;
    field: 'transactionNumber' | 'reference';
    format: RegExp;
    description: string;
    verify: typeof verifyTelebirr;
  }) =>
    app.post(
      config.path,
      {
        preHandler: requireRoles('owner', 'manager', 'waiter'),
        config: {
          rateLimit: {
            max: VERIFY_MAX_PER_MINUTE,
            timeWindow: '1 minute',
            keyGenerator: (request) => `verify:${request.headers.authorization ?? request.ip}`,
          },
        },
        schema: {
          tags: ['verification'],
          security: [{ bearerAuth: [] }],
          description: config.description,
          body: z.object({
            [config.field]: z.string().trim().toUpperCase().regex(config.format),
            expectedAmountEtb: z.number().int().positive().max(100_000_000),
            billId: z.string().min(1).max(64).optional(),
          }),
          response: {
            200: verifyResponseSchema,
            400: errorResponseSchema.describe('VALIDATION_ERROR'),
            401: errorResponseSchema.describe('UNAUTHORIZED'),
            403: errorResponseSchema.describe('FORBIDDEN'),
            404: errorResponseSchema.describe('NOT_FOUND (billId is not a bill of this business)'),
            429: errorResponseSchema.describe('RATE_LIMITED'),
          },
        },
      },
      async (request) => {
        const { businessId, memberId } = request.auth;
        const body = request.body as Record<string, unknown> & {
          expectedAmountEtb: number;
          billId?: string;
        };
        const { expectedAmountEtb, billId } = body;
        if (billId) {
          const bill = await app.prisma.bill.findFirst({
            where: { id: billId, businessId },
            select: { id: true },
          });
          if (!bill) throw new AppError('NOT_FOUND');
        }
        const result = await config.verify(
          app.prisma,
          app.env,
          businessId,
          String(body[config.field]),
          expectedAmountEtb,
          request.log
        );
        if (result.status !== 'verified') {
          await saveFailedCheck(app.prisma, {
            businessId,
            checkedById: memberId,
            billId,
            bankCode: config.bankCode,
            expectedAmountEtb,
            result,
          });
        }
        return result;
      }
    );

  referenceCheck({
    path: '/verify/telebirr',
    bankCode: 'TEL',
    field: 'transactionNumber',
    format: TELEBIRR_NUMBER,
    verify: verifyTelebirr,
    description:
      'Reads the telebirr receipt (transactioninfo.ethiotelecom.et/receipt/<number>) and ' +
      'checks it from its HTML. Telebirr to telebirr: receiver phone (first and last 4 ' +
      "digits) is one of the business's Telebirr numbers and the receiver name matches its " +
      'holder. Telebirr to a bank: the bank account number is one of its bank accounts and ' +
      'the name matches. Both: settled amount ≥ expected, status Completed, not too old. ' +
      'Unknown numbers give unable_to_verify NOT_FOUND. Failed checks are saved like CBE.',
  });

  referenceCheck({
    path: '/verify/dashen',
    bankCode: 'DAS',
    field: 'reference',
    format: DASHEN_REFERENCE,
    verify: verifyDashen,
    description:
      'Reads the Dashen receipt (receipts.dashenbanksc.com/receipt/<FT Ref>) and checks it ' +
      'from its HTML: the receiver account (printed with its middle hidden, 2926******311) ' +
      "fits one of the business's accounts (a Dashen one when sent to Dashen) and the receiver " +
      'name matches its holder; transaction amount ≥ expected; not too old. The page only ' +
      'exists for completed transfers; an unknown FT Ref gives NOT_FOUND.',
  });

  referenceCheck({
    path: '/verify/boa',
    bankCode: 'BOA',
    field: 'reference',
    format: BOA_RECEIPT_ID,
    verify: verifyBoa,
    description:
      'Reads the Bank of Abyssinia receipt (cs.bankofabyssinia.com, id = FT reference + the ' +
      "sender account's last 5 digits) and checks it: Receiver's Account is one of the " +
      "business's accounts (in full, or first/last digits when masked) and Receiver's Name " +
      'matches its holder; transferred amount ≥ expected; not too old. "Invalid reference ' +
      'number" gives NOT_FOUND.',
  });

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
          'Reads the CBE Transaction ID (FT + 10) from a receipt screenshot or photo: Gemini ' +
          '(GEMINI_API_KEY; one retry when busy), else Tesseract OCR; plus all the text read. The picture and text are not stored or logged. ' +
          'reference is null when none was found.',
        body: z.object({
          image: z.string().min(16).max(9_000_000).describe('PNG / JPEG / WebP, base64'),
          bank: z
            .enum(['CBE', 'TEL', 'DAS', 'BOA'])
            .default('CBE')
            .describe(
              'Whose receipt: CBE (FT reference), TEL (telebirr number), DAS (Dashen FT Ref)'
            ),
        }),
        response: {
          200: z.object({
            reference: z.string().nullable(),
            text: z.string().describe('All text read from the picture'),
            source: z.enum(['gemini', 'ocr']).describe('Which reader answered'),
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
      const type = imageType(image);
      if (image.length > MAX_IMAGE_BYTES || !type) {
        throw new AppError('VALIDATION_ERROR', { reason: 'image' });
      }
      const { reference, text, source } = await readPicture(
        image,
        type,
        request.body.bank,
        request.log
      );
      request.log.info(
        { readReference: reference ? 'found' : 'not_found', source },
        reference
          ? `Receipt picture (${source}): found ${reference}`
          : `Receipt picture (${source}): no Transaction ID found`
      );
      return { reference, text, source };
    }
  );

  // DEVELOPMENT ONLY: reads one picture with both Gemini and Tesseract (+ regex) to compare.
  if (app.env.NODE_ENV !== 'production') {
    const timed = async <T>(work: () => Promise<T>) => {
      const started = Date.now();
      try {
        const result = await work();
        return { ok: true as const, ms: Date.now() - started, ...result };
      } catch (error) {
        const reason = error instanceof GeminiError ? error.message : 'failed';
        return { ok: false as const, ms: Date.now() - started, error: reason };
      }
    };
    const resultSchema = z.object({
      ok: z.boolean(),
      ms: z.number().int(),
      reference: z.string().nullable().optional(),
      amount: z.number().nullable().optional(),
      date: z.string().nullable().optional(),
      text: z.string().optional(),
      error: z.string().optional(),
    });

    app.post(
      '/verify/read-compare',
      {
        preHandler: requireRoles('owner', 'manager'),
        bodyLimit: 9 * 1024 * 1024,
        config: {
          rateLimit: {
            max: READ_MAX_PER_MINUTE,
            timeWindow: '1 minute',
            keyGenerator: (request) => `compare:${request.headers.authorization ?? request.ip}`,
          },
        },
        schema: {
          tags: ['verification'],
          security: [{ bearerAuth: [] }],
          description:
            'DEVELOPMENT ONLY (absent in production): reads a receipt picture with Gemini ' +
            '(GEMINI_API_KEY) and with Tesseract + the FT regex, to compare them. Nothing is ' +
            'stored or logged.',
          body: z.object({
            image: z.string().min(16).max(9_000_000),
            bank: z.enum(['CBE', 'TEL', 'DAS', 'BOA']).default('CBE'),
          }),
          response: {
            200: z.object({ gemini: resultSchema, tesseract: resultSchema }),
            400: errorResponseSchema.describe('VALIDATION_ERROR (not a picture, or too big)'),
            401: errorResponseSchema.describe('UNAUTHORIZED'),
            403: errorResponseSchema.describe('FORBIDDEN'),
          },
        },
      },
      async (request) => {
        const image = Buffer.from(request.body.image, 'base64');
        const type = imageType(image);
        if (image.length > MAX_IMAGE_BYTES || !type) {
          throw new AppError('VALIDATION_ERROR', { reason: 'image' });
        }
        const { GEMINI_API_KEY: apiKey, GEMINI_MODEL: model } = app.env;
        const [gemini, tesseract] = await Promise.all([
          timed(async () => {
            if (!apiKey) throw new GeminiError('GEMINI_API_KEY is not set');
            return readWithGemini(image, type, { apiKey, model }, request.body.bank);
          }),
          timed(async () => {
            const text = await readImageText(image);
            return { reference: findReference(request.body.bank, text), text };
          }),
        ]);
        // Timing only: no picture, no text.
        request.log.info(
          { geminiMs: gemini.ms, geminiOk: gemini.ok, tesseractMs: tesseract.ms },
          'Receipt picture compared'
        );
        return { gemini, tesseract };
      }
    );
  }
};
