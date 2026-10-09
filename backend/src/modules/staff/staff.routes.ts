import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import type { BusinessMember, User } from '../../generated/prisma/client.js';
import { requireRoles } from '../../plugins/auth.js';
import { hashPin } from '../../services/pin-hasher.js';
import { AppError } from '../../shared/errors/app-error.js';
import { idParamSchema, phoneSchema, staffPinSchema } from '../../shared/schemas/common.js';
import { isUniqueViolation } from '../auth/auth.service.js';

const staffRole = z.enum(['manager', 'waiter', 'chef']);

/** Same as the app's `Staff` type, without the PIN (never returned). */
const staffSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  role: staffRole,
  canChangeDeliveryFee: z.boolean(),
  canSeeReports: z.boolean(),
  active: z.boolean(),
});

const toStaff = (m: BusinessMember & { user: User }) => ({
  id: m.id,
  name: m.user.name,
  phone: m.user.phone,
  role: m.role as z.infer<typeof staffRole>,
  canChangeDeliveryFee: m.canChangeDeliveryFee,
  canSeeReports: m.canSeeReports,
  active: m.active,
});

export const staffRoutes: FastifyPluginAsyncZod = async (app) => {
  const { prisma } = app;
  const canManage = requireRoles('owner', 'manager');

  app.get(
    '/staff',
    {
      preHandler: canManage,
      schema: {
        tags: ['staff'],
        security: [{ bearerAuth: [] }],
        response: { 200: z.array(staffSchema) },
      },
    },
    async (request) => {
      const members = await prisma.businessMember.findMany({
        where: { businessId: request.auth.businessId, role: { not: 'owner' } },
        include: { user: true },
        orderBy: { createdAt: 'asc' },
      });
      return members.map(toStaff);
    }
  );

  app.post(
    '/staff',
    {
      preHandler: canManage,
      schema: {
        tags: ['staff'],
        security: [{ bearerAuth: [] }],
        body: z.object({
          name: z.string().trim().min(2).max(80),
          phone: phoneSchema,
          pin: staffPinSchema,
          role: staffRole,
          canChangeDeliveryFee: z.boolean().default(false),
          canSeeReports: z.boolean().default(false),
        }),
        response: { 201: staffSchema },
      },
    },
    async (request, reply) => {
      const { auth } = request;
      const body = request.body;
      if (body.role === 'manager' && auth.role !== 'owner') throw new AppError('FORBIDDEN');
      // Phones are unique across all users so phone + PIN sign-in is never ambiguous.
      if (await prisma.user.findUnique({ where: { phone: body.phone } })) {
        throw new AppError('PHONE_TAKEN');
      }
      const isManager = body.role === 'manager';
      const pinHash = await hashPin(body.pin);
      try {
        const member = await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: { name: body.name, phone: body.phone, pinHash },
          });
          return tx.businessMember.create({
            data: {
              businessId: auth.businessId,
              userId: user.id,
              role: body.role,
              canChangeDeliveryFee: isManager || body.canChangeDeliveryFee,
              canSeeReports: isManager || body.canSeeReports,
              createdById: auth.memberId,
            },
            include: { user: true },
          });
        });
        return reply.status(201).send(toStaff(member));
      } catch (error) {
        if (isUniqueViolation(error)) throw new AppError('PHONE_TAKEN');
        throw error;
      }
    }
  );

  app.patch(
    '/staff/:id',
    {
      preHandler: canManage,
      schema: {
        tags: ['staff'],
        security: [{ bearerAuth: [] }],
        params: idParamSchema,
        body: z
          .object({
            active: z.boolean().optional(),
            canChangeDeliveryFee: z.boolean().optional(),
            canSeeReports: z.boolean().optional(),
          })
          .refine((b) => Object.keys(b).length > 0),
        response: { 200: staffSchema },
      },
    },
    async (request) => {
      const { auth } = request;
      const target = await prisma.businessMember.findFirst({
        where: { id: request.params.id, businessId: auth.businessId },
      });
      if (!target || target.role === 'owner') throw new AppError('NOT_FOUND');
      if (target.id === auth.memberId) throw new AppError('FORBIDDEN');
      if (target.role === 'manager' && auth.role !== 'owner') throw new AppError('FORBIDDEN');

      const updated = await prisma.$transaction(async (tx) => {
        const member = await tx.businessMember.update({
          where: { id: target.id },
          data: request.body,
          include: { user: true },
        });
        // Deactivating someone signs them out everywhere.
        if (request.body.active === false) {
          await tx.session.updateMany({
            where: { memberId: target.id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
        return member;
      });
      return toStaff(updated);
    }
  );
};
