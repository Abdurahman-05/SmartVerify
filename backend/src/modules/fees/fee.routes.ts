import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { requireRestaurantPlan, requireRoles } from '../../plugins/auth.js';
import { AppError } from '../../shared/errors/app-error.js';
import { errorResponseSchema } from '../../shared/schemas/common.js';

/** Integer ETB. */
const feeSchema = z.number().int().min(0).max(10_000);

const feesSchema = z.object({
  packingFeeEtb: z.number().int().describe('Added to every takeaway and delivery order'),
  deliveryAreas: z.array(
    z.object({ id: z.string(), name: z.string(), usualFeeEtb: z.number().int() })
  ),
});

const errors = {
  400: errorResponseSchema.describe('VALIDATION_ERROR'),
  401: errorResponseSchema.describe('UNAUTHORIZED'),
  402: errorResponseSchema.describe('SUBSCRIPTION_REQUIRED (restaurant plan only)'),
  403: errorResponseSchema.describe('FORBIDDEN'),
};

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

async function loadFees(prisma: PrismaClient | Prisma.TransactionClient, businessId: string) {
  const [business, deliveryAreas] = await Promise.all([
    prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { packingFeeEtb: true },
    }),
    prisma.deliveryArea.findMany({
      where: { businessId, active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, usualFeeEtb: true },
    }),
  ]);
  return { packingFeeEtb: business.packingFeeEtb, deliveryAreas };
}

/** Restaurant Plus: packing fee and delivery areas with their usual fee. */
export const feeRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', requireRestaurantPlan);
  const { prisma } = app;
  const security = [{ bearerAuth: [] }];

  app.get(
    '/fees',
    {
      preHandler: requireRoles('owner', 'manager', 'waiter'),
      schema: {
        tags: ['fees'],
        security,
        description: 'Packing fee and the delivery areas that are in use, for New order.',
        response: { 200: feesSchema, ...errors },
      },
    },
    async (request) => loadFees(prisma, request.auth.businessId)
  );

  app.put(
    '/fees',
    {
      preHandler: requireRoles('owner', 'manager'),
      schema: {
        tags: ['fees'],
        security,
        description:
          'Saves the whole Fees screen at once: the packing fee and the list of delivery areas. ' +
          'Areas with an id are updated; new names are added (or a removed area with that name ' +
          'is brought back); areas left out are removed (past bills keep their area). ' +
          'Names must be unique (ignoring case).',
        body: z.object({
          packingFeeEtb: feeSchema,
          deliveryAreas: z
            .array(
              z.object({
                id: z.string().min(1).max(64).optional(),
                name: z.string().trim().min(1).max(40),
                usualFeeEtb: feeSchema,
              })
            )
            .max(50),
        }),
        response: { 200: feesSchema, ...errors, 404: errorResponseSchema.describe('NOT_FOUND') },
      },
    },
    async (request) => {
      const { businessId } = request.auth;
      const { packingFeeEtb, deliveryAreas } = request.body;
      const names = deliveryAreas.map((a) => a.name.toLowerCase());
      if (new Set(names).size !== names.length) {
        throw new AppError('VALIDATION_ERROR', { reason: 'duplicateAreaName' });
      }

      try {
        return await prisma.$transaction(async (tx) => {
          await tx.business.update({ where: { id: businessId }, data: { packingFeeEtb } });
          const existing = await tx.deliveryArea.findMany({ where: { businessId } });
          const kept = new Set<string>();

          for (const area of deliveryAreas) {
            const match = area.id
              ? existing.find((e) => e.id === area.id)
              : existing.find((e) => !kept.has(e.id) && sameName(e.name, area.name));
            if (area.id && !match) throw new AppError('NOT_FOUND', { areaId: area.id });
            if (match) {
              kept.add(match.id);
              await tx.deliveryArea.update({
                where: { id: match.id },
                data: { name: area.name, usualFeeEtb: area.usualFeeEtb, active: true },
              });
            } else {
              const created = await tx.deliveryArea.create({
                data: { businessId, name: area.name, usualFeeEtb: area.usualFeeEtb },
              });
              kept.add(created.id);
            }
          }
          // Areas left out are turned off, never deleted: past bills still point to them.
          await tx.deliveryArea.updateMany({
            where: { businessId, id: { notIn: [...kept] }, active: true },
            data: { active: false },
          });
          return loadFees(tx, businessId);
        });
      } catch (error) {
        // Renaming an area to the name of a removed one (names are unique per business).
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new AppError('VALIDATION_ERROR', { reason: 'duplicateAreaName' });
        }
        throw error;
      }
    }
  );
};
