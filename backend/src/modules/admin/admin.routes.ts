import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { errorResponseSchema } from '../../shared/schemas/common.js';

import { createAdminAuth } from './admin-auth.js';

/** Sign-in tries per IP per 15 minutes (the account itself locks after 5 wrong ones). */
const SIGN_IN_MAX_PER_IP = 20;

const tokenResponse = z.object({ token: z.string() });
const codeSchema = z.string().regex(/^\d{6}$/);

const adminSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.enum(['super_admin']),
  idleTimeoutMinutes: z.number().int(),
  backupCodesLeft: z.number().int(),
});

const CATEGORIES = ['money', 'customers', 'rules', 'sign_in', 'private_data'] as const;

/**
 * The Smart Verify team's admin: separate accounts and sessions from businesses. Sign-in is
 * email + password, then an authenticator code; every action goes to the activity log.
 */
export const adminRoutes: FastifyPluginAsyncZod = async (app) => {
  const auth = createAdminAuth(app);
  const tags = ['admin'];
  const security = [{ bearerAuth: [] }];
  const passwordStage = {
    onRequest: (request: Parameters<typeof auth.authenticate>[0]) =>
      auth.authenticate(request, 'password'),
  };
  const fullStage = {
    onRequest: (request: Parameters<typeof auth.authenticate>[0]) =>
      auth.authenticate(request, 'full'),
  };

  app.post(
    '/admin/auth/sign-in',
    {
      config: { rateLimit: { max: SIGN_IN_MAX_PER_IP, timeWindow: '15 minutes' } },
      schema: {
        tags,
        description:
          'Step 1: email + password. Gives a short-lived token for step 2: "setup" (first ' +
          'time: set up the authenticator app) or "code" (type its 6-digit code).',
        body: z.object({
          email: z.string().trim().email().max(200),
          password: z.string().min(1).max(200),
        }),
        response: {
          200: z.object({ token: z.string(), next: z.enum(['setup', 'code']) }),
          401: errorResponseSchema.describe('WRONG_CREDENTIALS'),
          423: errorResponseSchema.describe('ACCOUNT_LOCKED (details.until)'),
          429: errorResponseSchema,
          501: errorResponseSchema.describe('ADMIN_NOT_CONFIGURED'),
        },
      },
    },
    async (request) => auth.signIn(request, request.body.email, request.body.password)
  );

  app.post(
    '/admin/auth/setup',
    {
      ...passwordStage,
      schema: {
        tags,
        security,
        description:
          'First sign-in only (step-1 token): a new authenticator secret, as a key to type and ' +
          'an otpauth:// link for a QR code. Shown once; never returned again.',
        response: {
          200: z.object({ secret: z.string(), otpauthUrl: z.string() }),
          401: errorResponseSchema,
          403: errorResponseSchema.describe('FORBIDDEN (two-step is already on)'),
        },
      },
    },
    async (request) => auth.startSetup(request)
  );

  app.post(
    '/admin/auth/setup/confirm',
    {
      ...passwordStage,
      schema: {
        tags,
        security,
        description:
          'The first code from the app turns two-step on. Answers the full token and 8 ' +
          'one-time backup codes (shown only now).',
        body: z.object({ code: codeSchema }),
        response: {
          200: z.object({ token: z.string(), backupCodes: z.array(z.string()) }),
          401: errorResponseSchema.describe('UNAUTHORIZED, or WRONG_CODE (details.triesLeft)'),
          403: errorResponseSchema,
          423: errorResponseSchema.describe('ACCOUNT_LOCKED'),
        },
      },
    },
    async (request) => auth.confirmSetup(request, request.body.code)
  );

  app.post(
    '/admin/auth/verify',
    {
      ...passwordStage,
      schema: {
        tags,
        security,
        description: 'Step 2: the 6-digit authenticator code, or one backup code.',
        body: z
          .object({
            code: codeSchema.optional(),
            backupCode: z.string().trim().min(8).max(12).optional(),
          })
          .refine((b) => !b.code !== !b.backupCode, 'code or backupCode'),
        response: {
          200: tokenResponse,
          401: errorResponseSchema.describe('UNAUTHORIZED, or WRONG_CODE (details.triesLeft)'),
          403: errorResponseSchema,
          423: errorResponseSchema.describe('ACCOUNT_LOCKED'),
        },
      },
    },
    async (request) => auth.verify(request, request.body)
  );

  app.post(
    '/admin/auth/sign-out',
    {
      ...passwordStage,
      schema: { tags, security, response: { 204: z.null(), 401: errorResponseSchema } },
    },
    async (request, reply) => {
      await auth.signOut(request);
      return reply.status(204).send(null);
    }
  );

  app.get(
    '/admin/me',
    {
      ...fullStage,
      schema: { tags, security, response: { 200: adminSchema, 401: errorResponseSchema } },
    },
    async (request) => {
      const { admin } = request.admin;
      return {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        idleTimeoutMinutes: admin.idleTimeoutMinutes,
        backupCodesLeft: await auth.backupCodesLeft(admin.id),
      };
    }
  );

  app.get(
    '/admin/activity',
    {
      ...fullStage,
      schema: {
        tags,
        security,
        description:
          'The activity log, newest first: every admin action and sign-in. Read-only: there ' +
          'is no way to edit or delete it. Page with `before` (the last item id).',
        querystring: z.object({
          category: z.enum(CATEGORIES).optional(),
          before: z.string().max(40).optional(),
          limit: z.coerce.number().int().min(1).max(100).default(30),
        }),
        response: {
          200: z.object({
            items: z.array(
              z.object({
                id: z.string(),
                createdAt: z.string(),
                adminName: z.string().nullable(),
                category: z.enum(CATEGORIES),
                action: z.string(),
                businessName: z.string().nullable(),
                details: z.record(z.string(), z.unknown()).nullable(),
                ip: z.string().nullable(),
                userAgent: z.string().nullable(),
              })
            ),
            nextBefore: z.string().nullable(),
            total: z.number().int(),
          }),
          401: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const { category, before, limit } = request.query;
      const where = category ? { category } : {};
      const [rows, total] = await Promise.all([
        app.prisma.adminActivity.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: limit + 1,
          ...(before ? { cursor: { id: before }, skip: 1 } : {}),
          include: { admin: { select: { name: true } } },
        }),
        app.prisma.adminActivity.count({ where }),
      ]);
      const page = rows.slice(0, limit);
      const businessIds = [...new Set(page.flatMap((r) => (r.businessId ? [r.businessId] : [])))];
      const businesses = businessIds.length
        ? await app.prisma.business.findMany({
            where: { id: { in: businessIds } },
            select: { id: true, name: true },
          })
        : [];
      const nameOf = new Map(businesses.map((b) => [b.id, b.name]));
      return {
        items: page.map((r) => ({
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          adminName: r.admin?.name ?? null,
          category: r.category as (typeof CATEGORIES)[number],
          action: r.action,
          businessName: r.businessId ? (nameOf.get(r.businessId) ?? null) : null,
          details:
            r.details && typeof r.details === 'object' && !Array.isArray(r.details)
              ? (r.details as Record<string, unknown>)
              : null,
          ip: r.ip,
          userAgent: r.userAgent,
        })),
        nextBefore: rows.length > limit ? (page[page.length - 1]?.id ?? null) : null,
        total,
      };
    }
  );
};
