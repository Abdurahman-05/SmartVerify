import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { requireRestaurantPlan, requireRoles } from '../../plugins/auth.js';
import { AppError } from '../../shared/errors/app-error.js';
import { errorResponseSchema, idParamSchema } from '../../shared/schemas/common.js';
import { normalizeName } from '../menu/menu.service.js';

const categoryNameSchema = z.string().trim().min(1).max(40);

const tableSchema = z.object({
  id: z.string(),
  number: z.number().int(),
  categoryId: z.string(),
  categoryName: z.string().describe('The group the table is in, e.g. "VIP"'),
  categoryNameAm: z.string().nullable(),
  busy: z.boolean().describe('Has an open dine-in bill'),
  openBillId: z.string().nullable(),
});

const tableCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  nameAm: z.string().nullable(),
  sortOrder: z.number().int(),
  tableCount: z.number().int().describe('Tables in use in it'),
});

const errors = {
  401: errorResponseSchema.describe('UNAUTHORIZED'),
  402: errorResponseSchema.describe('SUBSCRIPTION_REQUIRED (restaurant plan only)'),
  403: errorResponseSchema.describe('FORBIDDEN'),
};
const categoryConflict = {
  409: errorResponseSchema.describe('CATEGORY_DUPLICATE or CATEGORY_NOT_EMPTY'),
};

/** The three categories every business starts with (and gets back if it deletes them all). */
const DEFAULT_CATEGORIES = [
  { name: 'Main Floor', nameAm: 'ዋናው ወለል' },
  { name: 'Upstairs', nameAm: 'ፎቅ ላይ' },
  { name: 'Outside', nameAm: 'ውጪ' },
];

const liveCategories = (businessId: string) => ({ businessId, deletedAt: null });
const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

type Db = Prisma.TransactionClient | PrismaClient;

/** A business with no table categories (new, or deleted them all) gets the three starting ones. */
async function ensureCategories(db: Db, businessId: string) {
  if ((await db.tableCategory.count({ where: liveCategories(businessId) })) > 0) return;
  await db.tableCategory.createMany({
    data: DEFAULT_CATEGORIES.map((c, index) => ({ businessId, ...c, sortOrder: index })),
    skipDuplicates: true,
  });
}

const categorySelect = {
  id: true,
  name: true,
  nameAm: true,
  sortOrder: true,
  _count: { select: { tables: { where: { active: true } } } },
} as const;

const categoryView = ({
  _count,
  ...category
}: Prisma.TableCategoryGetPayload<{ select: typeof categorySelect }>) => ({
  ...category,
  tableCount: _count.tables,
});

async function assertNameFree(db: Db, businessId: string, name: string, exceptId?: string) {
  const others = await db.tableCategory.findMany({
    where: { ...liveCategories(businessId), ...(exceptId && { id: { not: exceptId } }) },
    select: { name: true },
  });
  const wanted = normalizeName(name);
  if (others.some((c) => normalizeName(c.name) === wanted))
    throw new AppError('CATEGORY_DUPLICATE');
}

async function listTables(prisma: PrismaClient, businessId: string) {
  const tables = await prisma.restaurantTable.findMany({
    where: { businessId, active: true },
    orderBy: [{ category: { sortOrder: 'asc' } }, { number: 'asc' }],
    include: {
      category: { select: { name: true, nameAm: true } },
      bills: { where: { status: 'open', type: 'dine' }, select: { id: true }, take: 1 },
    },
  });
  return tables.map((t) => ({
    id: t.id,
    number: t.number,
    categoryId: t.categoryId,
    categoryName: t.category.name,
    categoryNameAm: t.category.nameAm,
    busy: t.bills.length > 0,
    openBillId: t.bills[0]?.id ?? null,
  }));
}

/** Restaurant Plus: the business's tables. Everyone taking orders reads them; owner/manager set them up. */
export const tableRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', requireRestaurantPlan);
  const { prisma } = app;
  const security = [{ bearerAuth: [] }];
  const readers = requireRoles('owner', 'manager', 'waiter');
  const editors = requireRoles('owner', 'manager');

  app.get(
    '/tables',
    {
      preHandler: readers,
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
      preHandler: editors,
      schema: {
        tags: ['tables'],
        security,
        description:
          'Adds tables to a category, e.g. numbers 1..10. Numbers already in use in it are ' +
          'skipped; a removed table with the same number is brought back. Returns all tables.',
        body: z.object({
          categoryId: z.string().min(1).max(64).describe('One of GET /tables/categories'),
          numbers: z.array(z.number().int().min(1).max(999)).min(1).max(100),
        }),
        response: {
          200: z.array(tableSchema),
          400: errorResponseSchema.describe('VALIDATION_ERROR'),
          404: errorResponseSchema.describe('NOT_FOUND (category)'),
          ...errors,
        },
      },
    },
    async (request) => {
      const { businessId } = request.auth;
      const { categoryId } = request.body;
      const numbers = [...new Set(request.body.numbers)];
      const category = await prisma.tableCategory.findFirst({
        where: { id: categoryId, ...liveCategories(businessId) },
        select: { id: true },
      });
      if (!category) throw new AppError('NOT_FOUND', { field: 'categoryId' });
      await prisma.$transaction([
        // Bring back removed tables with these numbers…
        prisma.restaurantTable.updateMany({
          where: { businessId, categoryId, number: { in: numbers }, active: false },
          data: { active: true },
        }),
        // …and add the rest (existing ones are skipped by the unique (business, category, number)).
        prisma.restaurantTable.createMany({
          data: numbers.map((number) => ({ businessId, categoryId, number })),
          skipDuplicates: true,
        }),
      ]);
      return listTables(prisma, businessId);
    }
  );

  app.delete(
    '/tables/:id',
    {
      preHandler: editors,
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

  // ─── Categories ────────────────────────────────────────────────────────────

  app.get(
    '/tables/categories',
    {
      preHandler: readers,
      schema: {
        tags: ['tables'],
        security,
        description:
          'The table categories ("Main floor", "VIP", "Garden"…) in the owner’s order. A new ' +
          'business starts with Main Floor, Upstairs and Outside.',
        response: { 200: z.array(tableCategorySchema), ...errors },
      },
    },
    async (request) => {
      const { businessId } = request.auth;
      await ensureCategories(prisma, businessId);
      const rows = await prisma.tableCategory.findMany({
        where: liveCategories(businessId),
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: categorySelect,
      });
      return rows.map(categoryView);
    }
  );

  app.post(
    '/tables/categories',
    {
      preHandler: editors,
      schema: {
        tags: ['tables'],
        security,
        description:
          'Add a category at the end. A name already used (ignoring case and spaces) gives ' +
          'CATEGORY_DUPLICATE.',
        body: z.object({ name: categoryNameSchema, nameAm: categoryNameSchema.optional() }),
        response: {
          201: tableCategorySchema,
          400: errorResponseSchema.describe('VALIDATION_ERROR'),
          ...errors,
          ...categoryConflict,
        },
      },
    },
    async (request, reply) => {
      const { businessId } = request.auth;
      try {
        const created = await prisma.$transaction(async (tx) => {
          await ensureCategories(tx, businessId);
          await assertNameFree(tx, businessId, request.body.name);
          const last = await tx.tableCategory.aggregate({
            where: liveCategories(businessId),
            _max: { sortOrder: true },
          });
          return tx.tableCategory.create({
            data: { ...request.body, businessId, sortOrder: (last._max.sortOrder ?? -1) + 1 },
            select: categorySelect,
          });
        });
        return reply.status(201).send(categoryView(created));
      } catch (error) {
        throw isUniqueViolation(error) ? new AppError('CATEGORY_DUPLICATE') : error;
      }
    }
  );

  app.patch(
    '/tables/categories/:id',
    {
      preHandler: editors,
      schema: {
        tags: ['tables'],
        security,
        description: 'Rename a category (Amharic name: null clears it) or change its position.',
        params: idParamSchema,
        body: z
          .object({
            name: categoryNameSchema.optional(),
            nameAm: categoryNameSchema.nullable().optional(),
            sortOrder: z.number().int().min(0).max(100_000).optional(),
          })
          .refine((b) => Object.values(b).some((v) => v !== undefined), {
            message: 'Nothing to change',
          }),
        response: {
          200: tableCategorySchema,
          400: errorResponseSchema.describe('VALIDATION_ERROR'),
          404: errorResponseSchema.describe('NOT_FOUND'),
          ...errors,
          ...categoryConflict,
        },
      },
    },
    async (request) => {
      const { businessId } = request.auth;
      const { id } = request.params;
      const found = await prisma.tableCategory.findFirst({
        where: { id, ...liveCategories(businessId) },
        select: { id: true },
      });
      if (!found) throw new AppError('NOT_FOUND');
      try {
        if (request.body.name !== undefined) {
          await assertNameFree(prisma, businessId, request.body.name, id);
        }
        return categoryView(
          await prisma.tableCategory.update({
            where: { id },
            data: request.body,
            select: categorySelect,
          })
        );
      } catch (error) {
        throw isUniqueViolation(error) ? new AppError('CATEGORY_DUPLICATE') : error;
      }
    }
  );

  app.delete(
    '/tables/categories/:id',
    {
      preHandler: editors,
      schema: {
        tags: ['tables'],
        security,
        description:
          'Delete a category that has no tables in use. Otherwise CATEGORY_NOT_EMPTY: remove ' +
          'its tables first.',
        params: idParamSchema,
        response: {
          204: z.null(),
          404: errorResponseSchema.describe('NOT_FOUND'),
          ...errors,
          ...categoryConflict,
        },
      },
    },
    async (request, reply) => {
      const { businessId } = request.auth;
      const { id } = request.params;
      await prisma.$transaction(async (tx) => {
        const found = await tx.tableCategory.findFirst({
          where: { id, ...liveCategories(businessId) },
          select: { id: true },
        });
        if (!found) throw new AppError('NOT_FOUND');
        const tables = await tx.restaurantTable.count({ where: { categoryId: id, active: true } });
        if (tables > 0) throw new AppError('CATEGORY_NOT_EMPTY', { tables });
        await tx.tableCategory.update({ where: { id }, data: { deletedAt: new Date() } });
      });
      return reply.status(204).send(null);
    }
  );
};
