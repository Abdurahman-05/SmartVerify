import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import {
  anyPinSchema,
  errorResponseSchema,
  ownerPinSchema,
  phoneSchema,
} from '../../shared/schemas/common.js';

import { createAuthService } from './auth.service.js';
import { createEmailCodes } from './email-code.js';
import { loadSessionUser, sessionUserSchema } from './session-user.js';

const authResponse = z.object({
  token: z.string(),
  expiresAt: z.string(),
  user: sessionUserSchema,
});

/** Abuse limits (per IP; sign-in per IP + phone so one device cannot guess many PINs for one number). */
const REGISTER_MAX_PER_HOUR = 10;
const SIGN_IN_MAX_ATTEMPTS = 5;
const SIGN_IN_WINDOW = '15 minutes';

/** Public routes: register and sign-in. No SMS code yet: phone + PIN only. */
export const publicAuthRoutes: FastifyPluginAsyncZod = async (app) => {
  const auth = createAuthService(app);
  const codes = createEmailCodes(app);
  const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

  app.post(
    '/auth/email-code',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
      schema: {
        tags: ['auth'],
        description:
          'Owner sign-up, step 1: emails a 6-digit code (10 minutes). One every 45 s and 5 an ' +
          'hour per email. Without an email provider (development only) the code comes back as ' +
          '`devCode` instead.',
        body: z.object({ email: emailSchema }),
        response: {
          200: z.object({
            expiresInSeconds: z.number().int(),
            resendInSeconds: z.number().int(),
            devCode: z.string().optional(),
          }),
          409: errorResponseSchema.describe('EMAIL_TAKEN'),
          429: errorResponseSchema.describe('RATE_LIMITED (details.reason tooSoon | tooMany)'),
          503: errorResponseSchema.describe('EMAIL_NOT_SENT'),
        },
      },
    },
    async (request) => codes.send(request.body.email, request.log)
  );

  app.post(
    '/auth/verify-email',
    {
      config: { rateLimit: { max: 20, timeWindow: '15 minutes' } },
      schema: {
        tags: ['auth'],
        description:
          'Owner sign-up, step 2: the code from the email. Right: sign-up with this email is ' +
          'allowed for 30 minutes. Five wrong tries end the code (send a new one).',
        body: z.object({ email: emailSchema, code: z.string().regex(/^\d{6}$/) }),
        response: {
          200: z.object({ verified: z.literal(true) }),
          401: errorResponseSchema.describe(
            'WRONG_CODE (details.reason wrong | expired | tooManyTries, details.triesLeft)'
          ),
          429: errorResponseSchema,
        },
      },
    },
    async (request) => {
      await codes.verify(request.body.email, request.body.code);
      return { verified: true as const };
    }
  );

  app.post(
    '/auth/register',
    {
      config: { rateLimit: { max: REGISTER_MAX_PER_HOUR, timeWindow: '1 hour' } },
      schema: {
        tags: ['auth'],
        body: z.object({
          fullName: z.string().trim().min(2).max(80),
          businessName: z.string().trim().min(2).max(120),
          email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
          phone: phoneSchema,
          pin: ownerPinSchema,
        }),
        response: {
          201: authResponse,
          403: errorResponseSchema.describe('EMAIL_NOT_VERIFIED (POST /auth/verify-email first)'),
          409: errorResponseSchema.describe('PHONE_TAKEN, EMAIL_TAKEN'),
          429: errorResponseSchema,
        },
      },
    },
    async (request, reply) => reply.status(201).send(await auth.register(request.body))
  );

  app.post(
    '/auth/sign-in',
    {
      config: {
        rateLimit: {
          max: SIGN_IN_MAX_ATTEMPTS,
          timeWindow: SIGN_IN_WINDOW,
          keyGenerator: (request) => {
            const phone = (request.body as { phone?: unknown } | undefined)?.phone;
            return `sign-in:${request.ip}:${typeof phone === 'string' ? phone : ''}`;
          },
        },
      },
      schema: {
        tags: ['auth'],
        body: z.object({
          phone: phoneSchema,
          pin: anyPinSchema,
          rememberMe: z.boolean().default(false),
        }),
        response: { 200: authResponse, 401: errorResponseSchema, 429: errorResponseSchema },
      },
    },
    async (request) => auth.signIn(request.body)
  );
};

/** Authenticated routes: sign-out, current session and PIN change. */
export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  const auth = createAuthService(app);

  app.post(
    '/auth/sign-out',
    { schema: { tags: ['auth'], security: [{ bearerAuth: [] }], response: { 204: z.null() } } },
    async (request, reply) => {
      await auth.signOut(request.auth.sessionId);
      return reply.status(204).send(null);
    }
  );

  app.get(
    '/auth/me',
    {
      schema: {
        tags: ['auth'],
        security: [{ bearerAuth: [] }],
        response: { 200: sessionUserSchema, 401: errorResponseSchema },
      },
    },
    async (request) => loadSessionUser(app.prisma, request.auth.memberId)
  );

  app.post(
    '/auth/change-pin',
    {
      config: {
        // Guessing the current PIN from a stolen, signed-in phone is limited too.
        rateLimit: {
          max: SIGN_IN_MAX_ATTEMPTS,
          timeWindow: SIGN_IN_WINDOW,
          keyGenerator: (request) => `change-pin:${request.headers.authorization ?? request.ip}`,
        },
      },
      schema: {
        tags: ['auth'],
        security: [{ bearerAuth: [] }],
        description:
          'Change your own PIN. newPin: 6 digits for the owner, 4 for staff. A wrong current PIN ' +
          'gives WRONG_CREDENTIALS. Your other devices are signed out; this one stays signed in.',
        body: z.object({ currentPin: anyPinSchema, newPin: z.string().regex(/^\d{4,6}$/) }),
        response: {
          204: z.null(),
          400: errorResponseSchema.describe('VALIDATION_ERROR (wrong length or same PIN)'),
          401: errorResponseSchema.describe('WRONG_CREDENTIALS (current PIN) | UNAUTHORIZED'),
          429: errorResponseSchema.describe('RATE_LIMITED'),
        },
      },
    },
    async (request, reply) => {
      await auth.changePin(request.auth, request.body.currentPin, request.body.newPin);
      return reply.status(204).send(null);
    }
  );
};
