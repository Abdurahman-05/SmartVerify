import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import {
  anyPinSchema,
  errorResponseSchema,
  ownerPinSchema,
  phoneSchema,
} from '../../shared/schemas/common.js';

import { createAuthService } from './auth.service.js';
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

  app.post(
    '/auth/register',
    {
      config: { rateLimit: { max: REGISTER_MAX_PER_HOUR, timeWindow: '1 hour' } },
      schema: {
        tags: ['auth'],
        body: z.object({
          fullName: z.string().trim().min(2).max(80),
          businessName: z.string().trim().min(2).max(120),
          phone: phoneSchema,
          pin: ownerPinSchema,
        }),
        response: { 201: authResponse, 409: errorResponseSchema, 429: errorResponseSchema },
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
