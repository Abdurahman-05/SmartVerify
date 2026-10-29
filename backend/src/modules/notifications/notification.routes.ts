import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { errorResponseSchema } from '../../shared/schemas/common.js';

const notificationSchema = z.object({
  id: z.string(),
  type: z
    .string()
    .describe(
      'new_order | order_ready | big_payment | bad_receipt | daily_summary | plan_ending | plan_late'
    ),
  data: z.record(z.string(), z.unknown()).describe('Values for the text; the app translates'),
  read: z.boolean(),
  createdAt: z.string(),
});

/** How many are kept in the list (older ones are not shown). */
const LIST_SIZE = 50;

/** The signed-in person's own notifications. */
export const notificationRoutes: FastifyPluginAsyncZod = async (app) => {
  const { prisma } = app;
  const security = [{ bearerAuth: [] }];

  app.get(
    '/notifications',
    {
      schema: {
        tags: ['notifications'],
        security,
        description: `Your latest ${LIST_SIZE} notifications, newest first, and how many are unread.`,
        response: {
          200: z.object({ unread: z.number().int(), items: z.array(notificationSchema) }),
          401: errorResponseSchema.describe('UNAUTHORIZED'),
        },
      },
    },
    async (request) => {
      const memberId = request.auth.memberId;
      const [rows, unread] = await Promise.all([
        prisma.notification.findMany({
          where: { memberId },
          orderBy: { createdAt: 'desc' },
          take: LIST_SIZE,
        }),
        prisma.notification.count({ where: { memberId, readAt: null } }),
      ]);
      return {
        unread,
        items: rows.map((n) => ({
          id: n.id,
          type: n.type,
          data: (n.data ?? {}) as Record<string, unknown>,
          read: n.readAt !== null,
          createdAt: n.createdAt.toISOString(),
        })),
      };
    }
  );

  app.post(
    '/notifications/read',
    {
      schema: {
        tags: ['notifications'],
        security,
        description: 'Mark these as read; without ids, all of yours.',
        body: z.object({ ids: z.array(z.string().min(1).max(64)).max(100).optional() }),
        response: { 204: z.null(), 401: errorResponseSchema.describe('UNAUTHORIZED') },
      },
    },
    async (request, reply) => {
      await prisma.notification.updateMany({
        where: {
          memberId: request.auth.memberId,
          readAt: null,
          ...(request.body.ids && { id: { in: request.body.ids } }),
        },
        data: { readAt: new Date() },
      });
      return reply.status(204).send(null);
    }
  );
};
