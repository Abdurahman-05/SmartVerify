import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { requireRestaurantPlan } from '../../plugins/auth.js';

export const feeRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/fees',
    {
      preHandler: requireRestaurantPlan,
      schema: {
        tags: ['restaurant'],
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({
            packingFeeEtb: z.number().int(),
            deliveryAreas: z.array(
              z.object({ id: z.string(), name: z.string(), usualFeeEtb: z.number().int() })
            ),
          }),
        },
      },
    },
    async (request) => {
      const { businessId } = request.auth;
      const [business, deliveryAreas] = await Promise.all([
        app.prisma.business.findUniqueOrThrow({
          where: { id: businessId },
          select: { packingFeeEtb: true },
        }),
        app.prisma.deliveryArea.findMany({
          where: { businessId, active: true },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, usualFeeEtb: true },
        }),
      ]);
      return { packingFeeEtb: business.packingFeeEtb, deliveryAreas };
    }
  );
};
