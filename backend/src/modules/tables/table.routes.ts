import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { requireRestaurantPlan } from '../../plugins/auth.js';

const tableSchema = z.object({
  id: z.string(),
  number: z.number().int(),
  area: z.enum(['main', 'upstairs', 'outside']),
  busy: z.boolean(),
});

export const tableRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/tables',
    {
      preHandler: requireRestaurantPlan,
      schema: {
        tags: ['restaurant'],
        security: [{ bearerAuth: [] }],
        response: { 200: z.array(tableSchema) },
      },
    },
    async (request) => {
      const tables = await app.prisma.restaurantTable.findMany({
        where: { businessId: request.auth.businessId, active: true },
        orderBy: [{ area: 'asc' }, { number: 'asc' }],
        // A table is busy while it has an open dine-in bill.
        include: {
          bills: { where: { status: 'open', type: 'dine' }, select: { id: true }, take: 1 },
        },
      });
      return tables.map((t) => ({
        id: t.id,
        number: t.number,
        area: t.area,
        busy: t.bills.length > 0,
      }));
    }
  );
};
