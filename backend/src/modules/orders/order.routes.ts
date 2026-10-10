import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { requireRestaurantPlan, requireRoles } from '../../plugins/auth.js';
import { customerPhoneSchema, errorResponseSchema } from '../../shared/schemas/common.js';
import { billDetailSchema } from '../bills/bill-view.js';

import { createOrderService } from './order.service.js';

const id = z.string().min(1).max(64);

const newOrderSchema = z
  .object({
    type: z.enum(['dine', 'takeaway', 'delivery']),
    tableId: id.optional(),
    guests: z.number().int().min(1).max(50).optional(),
    customerName: z.string().trim().min(1).max(80).optional(),
    customerPhone: customerPhoneSchema.optional().describe('10 digits, 09… or 07…'),
    deliveryAreaId: id.optional(),
    address: z.string().trim().min(1).max(200).optional(),
    notes: z
      .array(z.enum(['noOnion', 'lessSpicy', 'rush', 'takeaway']))
      .max(10)
      .default([]),
    // Only id + quantity: prices always come from the menu in the database.
    items: z
      .array(z.object({ menuItemId: id, quantity: z.number().int().min(1).max(99) }))
      .min(1)
      .max(50),
  })
  .superRefine((o, ctx) => {
    const need = (field: keyof typeof o, when: boolean) => {
      if (when && o[field] === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: `${field} is required for ${o.type}`,
        });
      }
    };
    need('tableId', o.type === 'dine');
    need('customerName', o.type === 'takeaway');
    need('deliveryAreaId', o.type === 'delivery');
    need('address', o.type === 'delivery');
    need('customerPhone', o.type === 'delivery');
  });

/** Restaurant Plus: send a new order to the kitchen (creates its bill). */
export const orderRoutes: FastifyPluginAsyncZod = async (app) => {
  const orders = createOrderService(app.prisma);
  app.addHook('preHandler', requireRestaurantPlan);

  app.post(
    '/orders',
    {
      preHandler: requireRoles('owner', 'manager', 'waiter'),
      schema: {
        tags: ['orders'],
        security: [{ bearerAuth: [] }],
        description:
          'Creates the bill, order, items and kitchen ticket in one transaction. Prices and fees ' +
          'come from the database. dine needs tableId; takeaway needs customerName; delivery needs ' +
          'deliveryAreaId, address and customerPhone. Repeating an Idempotency-Key returns the ' +
          'first bill without creating anything.',
        headers: z.object({
          'idempotency-key': z.string().min(8).max(100).describe('A new UUID per user action'),
        }),
        body: newOrderSchema,
        response: {
          201: billDetailSchema,
          400: errorResponseSchema.describe('VALIDATION_ERROR'),
          401: errorResponseSchema.describe('UNAUTHORIZED'),
          402: errorResponseSchema.describe('SUBSCRIPTION_REQUIRED (restaurant plan only)'),
          403: errorResponseSchema.describe('FORBIDDEN (chef)'),
          404: errorResponseSchema.describe('NOT_FOUND (table or delivery area)'),
          409: errorResponseSchema.describe('TABLE_BUSY | ITEM_UNAVAILABLE'),
        },
      },
    },
    async (request, reply) =>
      reply
        .status(201)
        .send(await orders.place(request.auth, request.body, request.headers['idempotency-key']))
  );
};
