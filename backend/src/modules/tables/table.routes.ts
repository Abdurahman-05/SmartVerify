import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import type { PrismaClient } from '../../generated/prisma/client.js';
import { requireRestaurantPlan, requireRoles } from '../../plugins/auth.js';
import { AppError } from '../../shared/errors/app-error.js';
import { errorResponseSchema, idParamSchema } from '../../shared/schemas/common.js';

const areaSchema = z.enum(['main', 'upstairs', 'outside']);

const tableSchema = z.object({
  id: z.string(),
  number: z.number().int(),
  area: areaSchema,
  busy: z.boolean().describe('Has an open dine-in bill'),
  openBillId: z.string().nullable(),
});

const errors = {
  401: errorResponseSchema.describe('UNAUTHORIZED'),
  402: errorResponseSchema.describe('SUBSCRIPTION_REQUIRED (restaurant plan only)'),
  403: errorResponseSchema.describe('FORBIDDEN'),
};

async function listTables(prisma: PrismaClient, businessId: string) {
  const tables = await prisma.restaurantTable.findMany({
    where: { businessId, active: true },
    orderBy: [{ area: 'asc' }, { number: 'asc' }],
    include: {
      bills: { where: { status: 'open', type: 'dine' }, select: { id: true }, take: 1 },
    },
  });
  return tables.map((t) => ({
    id: t.id,
    number: t.number,
    area: t.area,
    busy: t.bills.length > 0,
    openBillId: t.bills[0]?.id ?? null,
  }));
}

/** Restaurant Plus: the business's tables. Everyone taking orders reads them; owner/manager set them up. */
export const tableRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', requireRestaurantPlan);
  const { prisma } = app;
  const security = [{ bearerAuth: [] }];

  app.get(
    '/tables',
    {
      preHandler: requireRoles('owner', 'manager', 'waiter'),
      schema: {
        tags: ['tables'],
        security,
        description: 'Tables in use, with busy = has an open dine-in bill.',
        response: { 200: z.array(tableSchema), ...errors },
      },
    },
    async (request) => listTables(prisma, request.auth.businessId)
  );

  app.post(
    '/tables',
    {
      preHandler: requireRoles('owner', 'manager'),
      schema: {
        tags: ['tables'],
        security,
        description:
          'Adds tables to an area, e.g. numbers 1..10. Numbers already in use are skipped; a ' +
          'removed table with the same number is brought back. Returns all tables.',
        body: z.object({
          area: areaSchema,
          numbers: z.array(z.number().int().min(1).max(999)).min(1).max(100),
        }),
        response: {
          200: z.array(tableSchema),
          400: errorResponseSchema.describe('VALIDATION_ERROR'),
          ...errors,
        },
      },
    },
    async (request) => {
      const { businessId } = request.auth;
      const { area } = request.body;
      const numbers = [...new Set(request.body.numbers)];
      await prisma.$transaction([
        // Bring back removed tables with these numbers…
        prisma.restaurantTable.updateMany({
          where: { businessId, area, number: { in: numbers }, active: false },
          data: { active: true },
        }),
        // …and add the rest (existing ones are skipped by the unique (business, area, number)).
        prisma.restaurantTable.createMany({
          data: numbers.map((number) => ({ businessId, area, number })),
          skipDuplicates: true,
        }),
      ]);
      return listTables(prisma, businessId);
    }
  );

  app.delete(
    '/tables/:id',
    {
      preHandler: requireRoles('owner', 'manager'),
      schema: {
        tags: ['tables'],
        security,
        description:
          'Removes a table from use (past bills keep it). A table with an open bill cannot be ' +
          'removed (TABLE_BUSY).',
        params: idParamSchema,
        response: {
          204: z.null(),
          ...errors,
          404: errorResponseSchema.describe('NOT_FOUND'),
          409: errorResponseSchema.describe('TABLE_BUSY'),
        },
      },
    },
    async (request, reply) => {
      const { businessId } = request.auth;
      const table = await prisma.restaurantTable.findFirst({
        where: { id: request.params.id, businessId, active: true },
        include: {
          bills: { where: { status: 'open', type: 'dine' }, select: { id: true }, take: 1 },
        },
      });
      if (!table) throw new AppError('NOT_FOUND');
      if (table.bills.length) throw new AppError('TABLE_BUSY');
      await prisma.restaurantTable.update({ where: { id: table.id }, data: { active: false } });
      return reply.status(204).send(null);
    }
  );
};
