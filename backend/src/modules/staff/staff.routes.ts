import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { Prisma, type Role } from '../../generated/prisma/client.js';
import type { AuthContext } from '../../plugins/auth.js';
import { requireRoles } from '../../plugins/auth.js';
import { hashPin, verifyPin } from '../../services/pin-hasher.js';
import { AppError } from '../../shared/errors/app-error.js';
import { errorResponseSchema, idParamSchema, phoneSchema } from '../../shared/schemas/common.js';

const staffRoleSchema = z.enum(['manager', 'waiter', 'chef']);
/** Staff PINs have 4 digits (the owner's has 6). */
const staffPinSchema = z.string().regex(/^\d{4}$/);

const staffSchema = z.object({
  id: z.string().describe('The membership id: use it in /staff/:id'),
  name: z.string(),
  phone: z.string().describe('9 digits without +251'),
  role: staffRoleSchema,
  active: z.boolean().describe('false = cannot sign in'),
  canChangeDeliveryFee: z.boolean(),
  canSeeReports: z.boolean(),
  pinIsTemporary: z.boolean().describe('The PIN was set by the owner or manager: must be changed'),
  editable: z.boolean().describe('Whether the signed-in person may change this member'),
  createdAt: z.string(),
});

const memberSelect = {
  id: true,
  role: true,
  active: true,
  canChangeDeliveryFee: true,
  canSeeReports: true,
  createdAt: true,
  createdById: true,
  user: { select: { name: true, phone: true, pinIsTemporary: true } },
} as const;

type MemberRow = Prisma.BusinessMemberGetPayload<{ select: typeof memberSelect }>;

/** The owner manages everyone but themselves; a manager manages waiters and chefs only. */
const canManage = (actor: Role, target: Role) =>
  actor === 'owner'
    ? target !== 'owner'
    : actor === 'manager'
      ? target === 'waiter' || target === 'chef'
      : false;

function view(row: MemberRow, auth: AuthContext) {
  return {
    id: row.id,
    name: row.user.name,
    phone: row.user.phone,
    role: row.role as z.infer<typeof staffRoleSchema>,
    active: row.active,
    canChangeDeliveryFee: row.canChangeDeliveryFee,
    canSeeReports: row.canSeeReports,
    pinIsTemporary: row.user.pinIsTemporary,
    editable: row.id !== auth.memberId && canManage(auth.role, row.role),
    createdAt: row.createdAt.toISOString(),
  };
}

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

/** A retried "add" (the answer was lost) finds the member it already created. */
const REPLAY_WINDOW_MS = 10 * 60_000;

const errors = {
  401: errorResponseSchema.describe('UNAUTHORIZED'),
  403: errorResponseSchema.describe(
    'FORBIDDEN (owner and manager only, and only for people they manage)'
  ),
};

/** Staff accounts: the owner and managers add people, turn them on or off and reset their PIN. */
export const staffRoutes: FastifyPluginAsyncZod = async (app) => {
  const { prisma } = app;
  const security = [{ bearerAuth: [] }];
  const managers = requireRoles('owner', 'manager');

  /** The member of this business that the signed-in person is allowed to change. */
  async function manageable(auth: AuthContext, id: string) {
    const target = await prisma.businessMember.findFirst({
      where: { id, businessId: auth.businessId },
      select: { id: true, userId: true, role: true },
    });
    if (!target) throw new AppError('NOT_FOUND');
    if (target.id === auth.memberId || !canManage(auth.role, target.role)) {
      throw new AppError('FORBIDDEN');
    }
    return target;
  }

  /** Normal plans have one kind of staff: workers (the waiter role: verify, history). */
  function onlyWorkersOnNormal(auth: AuthContext, role: Role) {
    if (auth.plan === 'restaurant' || role === 'waiter') return;
    throw new AppError('VALIDATION_ERROR', { reason: 'workerOnly' });
  }

  app.get(
    '/staff',
    {
      preHandler: managers,
      schema: {
        tags: ['staff'],
        security,
        description:
          'Everyone in the business except the owner: active people first, then by when they ' +
          'were added. PINs and hashes are never returned.',
        response: { 200: z.array(staffSchema), ...errors },
      },
    },
    async (request) => {
      const rows = await prisma.businessMember.findMany({
        where: { businessId: request.auth.businessId, role: { not: 'owner' } },
        orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
        select: memberSelect,
      });
      return rows.map((row) => view(row, request.auth));
    }
  );

  app.post(
    '/staff',
    {
      preHandler: managers,
      schema: {
        tags: ['staff'],
        security,
        description:
          'Add a person with a first PIN that you choose (4 digits). It is marked temporary: they ' +
          'must change it when they first sign in. Only the owner can add a manager. A phone ' +
          'number that already has an account gives PHONE_TAKEN. Repeating the same add within ' +
          '10 minutes returns the member it created.',
        body: z.object({
          name: z.string().trim().min(2).max(80),
          phone: phoneSchema,
          pin: staffPinSchema,
          role: staffRoleSchema,
          canChangeDeliveryFee: z.boolean().default(false),
          canSeeReports: z.boolean().default(false),
        }),
        response: {
          201: staffSchema,
          400: errorResponseSchema.describe('VALIDATION_ERROR'),
          409: errorResponseSchema.describe('PHONE_TAKEN'),
          ...errors,
        },
      },
    },
    async (request, reply) => {
      const { auth, body } = request;
      if (!canManage(auth.role, body.role)) throw new AppError('FORBIDDEN');
      onlyWorkersOnNormal(auth, body.role);

      const existing = await prisma.user.findUnique({
        where: { phone: body.phone },
        include: { membership: { select: memberSelect } },
      });
      if (existing) {
        const member = existing.membership;
        const sameRequest =
          member &&
          member.createdById === auth.memberId &&
          member.role === body.role &&
          existing.name === body.name &&
          Date.now() - member.createdAt.getTime() < REPLAY_WINDOW_MS &&
          (await verifyPin(existing.pinHash, body.pin));
        if (sameRequest) return reply.status(201).send(view(member, auth));
        throw new AppError('PHONE_TAKEN');
      }

      const pinHash = await hashPin(body.pin);
      try {
        const created = await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: { name: body.name, phone: body.phone, pinHash, pinIsTemporary: true },
          });
          return tx.businessMember.create({
            data: {
              businessId: auth.businessId,
              userId: user.id,
              role: body.role,
              canChangeDeliveryFee: body.canChangeDeliveryFee,
              canSeeReports: body.canSeeReports,
              createdById: auth.memberId,
            },
            select: memberSelect,
          });
        });
        return reply.status(201).send(view(created, auth));
      } catch (error) {
        // The same phone was added at the same moment.
        if (isUniqueViolation(error)) throw new AppError('PHONE_TAKEN');
        throw error;
      }
    }
  );

  app.patch(
    '/staff/:id',
    {
      preHandler: managers,
      schema: {
        tags: ['staff'],
        security,
        description:
          'Change name, role, permissions or active. active=false signs the person out at once ' +
          'and they cannot sign in until you turn it back on. You cannot change yourself, the ' +
          'owner, or (as a manager) another manager.',
        params: idParamSchema,
        body: z
          .object({
            name: z.string().trim().min(2).max(80).optional(),
            role: staffRoleSchema.optional(),
            active: z.boolean().optional(),
            canChangeDeliveryFee: z.boolean().optional(),
            canSeeReports: z.boolean().optional(),
          })
          .refine((b) => Object.values(b).some((v) => v !== undefined), {
            message: 'Nothing to change',
          }),
        response: {
          200: staffSchema,
          400: errorResponseSchema.describe('VALIDATION_ERROR'),
          404: errorResponseSchema.describe('NOT_FOUND'),
          ...errors,
        },
      },
    },
    async (request) => {
      const { auth, body } = request;
      const target = await manageable(auth, request.params.id);
      if (body.role && !canManage(auth.role, body.role)) throw new AppError('FORBIDDEN');
      if (body.role) onlyWorkersOnNormal(auth, body.role);

      const { name, ...member } = body;
      const updated = await prisma.$transaction(async (tx) => {
        const row = await tx.businessMember.update({
          where: { id: target.id },
          data: { ...member, ...(name && { user: { update: { name } } }) },
          select: memberSelect,
        });
        if (body.active === false) {
          await tx.session.updateMany({
            where: { memberId: target.id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
        return row;
      });
      return view(updated, auth);
    }
  );

  app.post(
    '/staff/:id/reset-pin',
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 hour',
          keyGenerator: (request) => `reset-pin:${request.headers.authorization ?? request.ip}`,
        },
      },
      preHandler: managers,
      schema: {
        tags: ['staff'],
        security,
        description:
          'For someone who forgot their PIN: set a new temporary PIN (4 digits) that you tell ' +
          'them. They are signed out everywhere and must choose their own PIN when they sign in. ' +
          'The PIN is stored only as a hash and never returned.',
        params: idParamSchema,
        body: z.object({ pin: staffPinSchema }),
        response: {
          204: z.null(),
          400: errorResponseSchema.describe('VALIDATION_ERROR'),
          404: errorResponseSchema.describe('NOT_FOUND'),
          429: errorResponseSchema.describe('RATE_LIMITED'),
          ...errors,
        },
      },
    },
    async (request, reply) => {
      const target = await manageable(request.auth, request.params.id);
      const pinHash = await hashPin(request.body.pin);
      await prisma.$transaction([
        prisma.user.update({
          where: { id: target.userId },
          data: { pinHash, pinIsTemporary: true },
        }),
        prisma.session.updateMany({
          where: { userId: target.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        }),
      ]);
      return reply.status(204).send(null);
    }
  );
};
