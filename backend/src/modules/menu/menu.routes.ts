import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { Prisma } from '../../generated/prisma/client.js';
import { requireRestaurantPlan, requireRoles } from '../../plugins/auth.js';
import { AppError } from '../../shared/errors/app-error.js';
import { errorResponseSchema, idParamSchema } from '../../shared/schemas/common.js';

const categorySchema = z.enum(['food', 'drinks', 'combos']);
const nameSchema = z.string().trim().min(1).max(80);
/** Integer ETB, at least 1. */
const priceSchema = z.number().int().min(1).max(1_000_000);

const menuItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  priceEtb: z.number().int(),
  category: categorySchema,
  active: z.boolean().describe('false = "Finished today": hidden from New order'),
});

const select = { id: true, name: true, priceEtb: true, category: true, active: true } as const;

const errors = {
  400: errorResponseSchema.describe('VALIDATION_ERROR'),
  401: errorResponseSchema.describe('UNAUTHORIZED'),
  402: errorResponseSchema.describe('SUBSCRIPTION_REQUIRED (restaurant plan only)'),
  403: errorResponseSchema.describe('FORBIDDEN'),
};

/** Restaurant Plus menu. Everyone taking orders reads it; owner and manager edit it. */
export const menuRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', requireRestaurantPlan);
  const { prisma } = app;

  app.get(
    '/menu',
    {
      preHandler: requireRoles('owner', 'manager', 'waiter'),
      schema: {
        tags: ['menu'],
        security: [{ bearerAuth: [] }],
        description:
          'Available items, by category. `all=true` (owner, manager) also returns items that are ' +
          'turned off, for the Menu admin screen.',
        querystring: z.object({
          all: z
            .enum(['true', 'false'])
            .default('false')
            .transform((v) => v === 'true'),
        }),
        response: { 200: z.array(menuItemSchema), ...errors },
      },
    },
    async (request) => {
      const { businessId, role } = request.auth;
      const includeOff = request.query.all && (role === 'owner' || role === 'manager');
      return prisma.menuItem.findMany({
        where: { businessId, ...(!includeOff && { active: true }) },
        orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
        select,
      });
    }
  );

  app.post(
    '/menu',
    {
      preHandler: requireRoles('owner', 'manager'),
      schema: {
        tags: ['menu'],
        security: [{ bearerAuth: [] }],
        description:
          'Adds an item (turned on). Repeating an Idempotency-Key returns the first item.',
        headers: z.object({
          'idempotency-key': z.string().min(8).max(100).describe('A new UUID per user action'),
        }),
        body: z.object({ name: nameSchema, priceEtb: priceSchema, category: categorySchema }),
        response: { 201: menuItemSchema, ...errors },
      },
    },
    async (request, reply) => {
      const { businessId } = request.auth;
      const idempotencyKey = request.headers['idempotency-key'];
      const replay = () =>
        prisma.menuItem.findUnique({
          where: { businessId_idempotencyKey: { businessId, idempotencyKey } },
          select,
        });

      const existing = await replay();
      if (existing) return reply.status(201).send(existing);
      try {
        const item = await prisma.menuItem.create({
          data: { ...request.body, businessId, idempotencyKey },
          select,
        });
        return reply.status(201).send(item);
      } catch (error) {
        // The same add arrived twice at once: return the one that was saved.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const winner = await replay();
          if (winner) return reply.status(201).send(winner);
        }
        throw error;
      }
    }
  );

  app.patch(
    '/menu/:id',
    {
      preHandler: requireRoles('owner', 'manager'),
      schema: {
        tags: ['menu'],
        security: [{ bearerAuth: [] }],
        description:
          'Change name, price, category, or turn the item on/off. Past orders keep their own ' +
          'copy of name and price, so they never change.',
        params: idParamSchema,
        body: z
          .object({
            name: nameSchema.optional(),
            priceEtb: priceSchema.optional(),
            category: categorySchema.optional(),
            active: z.boolean().optional(),
          })
          .refine((b) => Object.values(b).some((v) => v !== undefined), {
            message: 'Nothing to change',
          }),
        response: {
          200: menuItemSchema,
          ...errors,
          404: errorResponseSchema.describe('NOT_FOUND'),
        },
      },
    },
    async (request) => {
      const { businessId } = request.auth;
      const { count } = await prisma.menuItem.updateMany({
        where: { id: request.params.id, businessId },
        data: request.body,
      });
      if (count === 0) throw new AppError('NOT_FOUND');
      return prisma.menuItem.findUniqueOrThrow({ where: { id: request.params.id }, select });
    }
  );
};
