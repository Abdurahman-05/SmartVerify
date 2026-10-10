import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { requireRestaurantPlan, requireRoles } from '../../plugins/auth.js';
import { errorResponseSchema } from '../../shared/schemas/common.js';

const tableSchema = z.object({
  id: z.string(),
  number: z.number().int(),
  area: z.enum(['main', 'upstairs', 'outside']),
  busy: z.boolean().describe('Has an open dine-in bill'),
  openBillId: z.string().nullable(),
});

/** Restaurant Plus: active tables with their busy state, for New order. */
export const tableRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', requireRestaurantPlan);

  app.get(
    '/tables',
    {
      preHandler: requireRoles('owner', 'manager', 'waiter'),
      schema: {
        tags: ['tables'],
        security: [{ bearerAuth: [] }],
        response: {
          200: z.array(tableSchema),
          401: errorResponseSchema.describe('UNAUTHORIZED'),
          402: errorResponseSchema.describe('SUBSCRIPTION_REQUIRED (restaurant plan only)'),
          403: errorResponseSchema.describe('FORBIDDEN (chef)'),
        },
      },
    },
    async (request) => {
      const tables = await app.prisma.restaurantTable.findMany({
        where: { businessId: request.auth.businessId, active: true },
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
  );
};
