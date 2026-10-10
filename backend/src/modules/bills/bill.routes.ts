import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { requireRestaurantPlan, requireRoles } from '../../plugins/auth.js';
import { errorResponseSchema, etbSchema, idParamSchema } from '../../shared/schemas/common.js';

import { createBillService } from './bill.service.js';
import { billDetailSchema, billListItemSchema } from './bill-view.js';

const errors = {
  400: errorResponseSchema.describe('VALIDATION_ERROR'),
  401: errorResponseSchema.describe('UNAUTHORIZED'),
  402: errorResponseSchema.describe('SUBSCRIPTION_REQUIRED (restaurant plan only)'),
  403: errorResponseSchema.describe('FORBIDDEN'),
  404: errorResponseSchema.describe('NOT_FOUND (also: a waiter asking for another waiter’s bill)'),
};

/** Restaurant Plus: open / paid bills. Chefs use the kitchen screen instead. */
export const billRoutes: FastifyPluginAsyncZod = async (app) => {
  const bills = createBillService(app.prisma);
  app.addHook('preHandler', requireRestaurantPlan);

  app.get(
    '/bills',
    {
      preHandler: requireRoles('owner', 'manager', 'waiter'),
      schema: {
        tags: ['bills'],
        security: [{ bearerAuth: [] }],
        description: 'Waiters see only their own bills. Newest first, cursor pagination.',
        querystring: z.object({
          status: z.enum(['open', 'paid']).optional(),
          type: z.enum(['dine', 'takeaway', 'delivery']).optional(),
          mine: z
            .enum(['true', 'false'])
            .default('false')
            .transform((v) => v === 'true')
            .describe('true = only bills of the signed-in member'),
          cursor: z.string().max(64).optional().describe('nextCursor from the previous page'),
          limit: z.coerce.number().int().min(1).max(100).default(20),
        }),
        response: {
          200: z.object({ items: z.array(billListItemSchema), nextCursor: z.string().nullable() }),
          ...errors,
        },
      },
    },
    async (request) => bills.list(request.auth, request.query)
  );

  app.get(
    '/bills/:id',
    {
      preHandler: requireRoles('owner', 'manager', 'waiter'),
      schema: {
        tags: ['bills'],
        security: [{ bearerAuth: [] }],
        params: idParamSchema,
        response: { 200: billDetailSchema, ...errors },
      },
    },
    async (request) => bills.get(request.auth, request.params.id)
  );

  app.patch(
    '/bills/:id/delivery-fee',
    {
      preHandler: requireRoles('owner', 'manager', 'waiter'),
      schema: {
        tags: ['bills'],
        security: [{ bearerAuth: [] }],
        description:
          'Owner, manager, or a member with canChangeDeliveryFee. Open delivery bills only. ' +
          'Recalculates totalEtb; usualDeliveryFeeEtb is kept.',
        params: idParamSchema,
        body: z.object({ amount: etbSchema.max(100_000) }),
        response: {
          200: billDetailSchema,
          ...errors,
          400: errorResponseSchema.describe('VALIDATION_ERROR (also: not a delivery bill)'),
          409: errorResponseSchema.describe('BILL_CLOSED'),
        },
      },
    },
    async (request) => bills.changeDeliveryFee(request.auth, request.params.id, request.body.amount)
  );
};
