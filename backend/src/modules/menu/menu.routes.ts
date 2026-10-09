import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { requireRestaurantPlan } from '../../plugins/auth.js';

const menuItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  priceEtb: z.number().int(),
  category: z.enum(['food', 'drinks', 'combos']),
});

export const menuRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/menu',
    {
      preHandler: requireRestaurantPlan,
      schema: {
        tags: ['restaurant'],
        security: [{ bearerAuth: [] }],
        response: { 200: z.array(menuItemSchema) },
      },
    },
    async (request) =>
      app.prisma.menuItem.findMany({
        where: { businessId: request.auth.businessId, active: true },
        orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, priceEtb: true, category: true },
      })
  );
};
