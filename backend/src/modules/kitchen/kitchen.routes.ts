import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import type { KitchenStatus, Prisma, PrismaClient } from '../../generated/prisma/client.js';
import type { AuthContext } from '../../plugins/auth.js';
import { requireRestaurantPlan, requireRoles } from '../../plugins/auth.js';
import { AppError } from '../../shared/errors/app-error.js';
import { errorResponseSchema, idParamSchema } from '../../shared/schemas/common.js';
import { notify } from '../../services/notifications.js';

const statusSchema = z.enum(['new', 'cooking', 'ready']);

const kitchenOrderSchema = z.object({
  id: z.string(),
  billId: z.string(),
  orderNo: z.number().int(),
  label: z.string().describe('"Table 12", "Takeaway #1044", "Delivery #1043"'),
  type: z.enum(['dine', 'takeaway', 'delivery']),
  waiterName: z.string(),
  guests: z.number().int().nullable(),
  area: z.string().nullable().describe('Delivery area name (delivery only)'),
  customerName: z.string().nullable(),
  items: z.array(z.object({ qty: z.number().int(), name: z.string() })),
  notes: z.array(z.string()).describe('Kitchen note codes, e.g. "noOnion"'),
  status: statusSchema,
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  readyAt: z.string().nullable(),
});

const include = {
  order: {
    select: {
      number: true,
      notes: true,
      waiterId: true,
      waiter: { select: { user: { select: { name: true } } } },
      items: { orderBy: { id: 'asc' }, select: { name: true, quantity: true } },
      bill: {
        select: {
          id: true,
          type: true,
          guests: true,
          customerName: true,
          table: { select: { number: true } },
          deliveryArea: { select: { name: true } },
        },
      },
    },
  },
} satisfies Prisma.KitchenOrderInclude;

type Row = Prisma.KitchenOrderGetPayload<{ include: typeof include }>;

function toKitchenOrder(row: Row) {
  const { order } = row;
  const { bill } = order;
  const label =
    bill.type === 'dine'
      ? `Table ${bill.table?.number ?? ''}`.trim()
      : `${bill.type === 'takeaway' ? 'Takeaway' : 'Delivery'} #${order.number}`;
  return {
    id: row.id,
    billId: bill.id,
    orderNo: order.number,
    label,
    type: bill.type,
    waiterName: order.waiter.user.name,
    guests: bill.guests,
    area: bill.deliveryArea?.name ?? null,
    customerName: bill.customerName,
    items: order.items.map((i) => ({ qty: i.quantity, name: i.name })),
    notes: order.notes,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    readyAt: row.readyAt?.toISOString() ?? null,
  };
}

/** Ready orders stay on the screen for this long, then drop off the list. */
const READY_VISIBLE_MS = 12 * 3_600_000;

async function loadOne(
  prisma: PrismaClient | Prisma.TransactionClient,
  auth: AuthContext,
  id: string
) {
  const row = await prisma.kitchenOrder.findFirst({
    where: { id, businessId: auth.businessId },
    include,
  });
  if (!row) throw new AppError('NOT_FOUND');
  return row;
}

const errors = {
  401: errorResponseSchema.describe('UNAUTHORIZED'),
  402: errorResponseSchema.describe('SUBSCRIPTION_REQUIRED (restaurant plan only)'),
  403: errorResponseSchema.describe('FORBIDDEN (chef, owner and manager only)'),
};

/** Restaurant Plus kitchen: every sent order is a ticket, new -> cooking -> ready. */
export const kitchenRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', requireRestaurantPlan);
  const { prisma } = app;
  const cooks = requireRoles('chef', 'owner', 'manager');
  const security = [{ bearerAuth: [] }];

  app.get(
    '/kitchen/orders',
    {
      preHandler: cooks,
      schema: {
        tags: ['kitchen'],
        security,
        description:
          'Kitchen tickets, oldest first. Without `status`: new, cooking and orders that became ' +
          'ready in the last 12 hours.',
        querystring: z.object({ status: statusSchema.optional() }),
        response: { 200: z.array(kitchenOrderSchema), ...errors },
      },
    },
    async (request) => {
      const { status } = request.query;
      const readySince = new Date(Date.now() - READY_VISIBLE_MS);
      const where: Prisma.KitchenOrderWhereInput = {
        businessId: request.auth.businessId,
        ...(status
          ? { status, ...(status === 'ready' && { readyAt: { gte: readySince } }) }
          : {
              OR: [
                { status: { in: ['new', 'cooking'] as KitchenStatus[] } },
                { status: 'ready', readyAt: { gte: readySince } },
              ],
            }),
      };
      const rows = await prisma.kitchenOrder.findMany({
        where,
        include,
        orderBy: { createdAt: 'asc' },
        take: 200,
      });
      return rows.map(toKitchenOrder);
    }
  );

  app.post(
    '/kitchen/orders/:id/start',
    {
      preHandler: cooks,
      schema: {
        tags: ['kitchen'],
        security,
        description: 'Start cooking: new -> cooking. Doing it again changes nothing.',
        params: idParamSchema,
        response: {
          200: kitchenOrderSchema,
          ...errors,
          404: errorResponseSchema.describe('NOT_FOUND'),
        },
      },
    },
    async (request) => {
      const row = await loadOne(prisma, request.auth, request.params.id);
      if (row.status === 'new') {
        await prisma.kitchenOrder.updateMany({
          where: { id: row.id, status: 'new' },
          data: { status: 'cooking', startedAt: new Date() },
        });
      }
      return toKitchenOrder(await loadOne(prisma, request.auth, row.id));
    }
  );

  app.post(
    '/kitchen/orders/:id/ready',
    {
      preHandler: cooks,
      schema: {
        tags: ['kitchen'],
        security,
        description:
          'Food is ready: -> ready. When every order of the bill is ready, the bill becomes ' +
          '"served". Doing it again changes nothing.',
        params: idParamSchema,
        response: {
          200: kitchenOrderSchema,
          ...errors,
          404: errorResponseSchema.describe('NOT_FOUND'),
        },
      },
    },
    async (request) => {
      const row = await loadOne(prisma, request.auth, request.params.id);
      if (row.status !== 'ready') {
        await prisma.$transaction(async (tx) => {
          const now = new Date();
          await tx.kitchenOrder.update({
            where: { id: row.id },
            data: { status: 'ready', readyAt: now, startedAt: row.startedAt ?? now },
          });
          const waiting = await tx.kitchenOrder.count({
            where: { order: { billId: row.order.bill.id }, status: { not: 'ready' } },
          });
          if (waiting === 0) {
            await tx.bill.update({
              where: { id: row.order.bill.id },
              data: { servedStatus: 'served' },
            });
          }
        });
        // The waiter who took the order picks it up.
        await notify(prisma, request.log, {
          businessId: request.auth.businessId,
          to: { memberIds: [row.order.waiterId] },
          type: 'order_ready',
          data: {
            orderNo: row.order.number,
            type: row.order.bill.type,
            table: row.order.bill.table?.number ?? null,
          },
        });
      }
      return toKitchenOrder(await loadOne(prisma, request.auth, row.id));
    }
  );
};
