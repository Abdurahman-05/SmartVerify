import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { requireRestaurantPlan, requireRoles } from '../../plugins/auth.js';
import { errorResponseSchema, idParamSchema } from '../../shared/schemas/common.js';

import { createMenuService, MAX_IMPORT_ITEMS, MAX_PRICE_ETB } from './menu.service.js';

const categorySchema = z.enum(['food', 'drinks', 'combos']);
const nameSchema = z.string().trim().min(1).max(80);
const nameAmSchema = z.string().trim().min(1).max(80);
const groupNameSchema = z.string().trim().min(1).max(60);
/** Integer ETB. */
const priceSchema = z.number().int().min(1).max(MAX_PRICE_ETB);
const percentSchema = z
  .number()
  .min(-50)
  .max(200)
  .describe('Rounded to the nearest 5 ETB, at least 1');
const idSchema = z.string().min(1).max(64);
const idsSchema = z.array(idSchema).min(1).max(200);
const keySchema = z.string().min(1).max(60);

const categoryNameSchema = z.string().trim().min(1).max(40);

const itemCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  nameAm: z.string().nullable(),
  kind: categorySchema,
  sortOrder: z.number().int(),
  itemCount: z.number().int().describe('Items in it that are not deleted'),
});

const menuItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  nameAm: z.string().nullable(),
  priceEtb: z.number().int(),
  category: categorySchema.describe('Kind of its category (food, drinks, combos)'),
  categoryId: z.string(),
  categoryName: z.string().describe('The category the owner put it in, e.g. "Hot drinks"'),
  categoryNameAm: z.string().nullable(),
  groupName: z.string().nullable().describe('Section shown to users, e.g. "Meat & Tibs"'),
  active: z.boolean().describe('false = "Finished today": hidden from New order'),
  sortOrder: z.number().int(),
});

const countsSchema = { itemCount: z.number().int(), addedCount: z.number().int() };
const packSchema = z.object({
  key: z.string(),
  name: z.string(),
  nameAm: z.string(),
  ...countsSchema,
  groups: z.array(
    z.object({
      key: z.string(),
      name: z.string(),
      nameAm: z.string(),
      category: categorySchema,
      ...countsSchema,
    })
  ),
});

const catalogItemSchema = z.object({
  key: z.string().describe('Stable slug, e.g. "doro-wat"'),
  name: z.string(),
  nameAm: z.string(),
  category: categorySchema,
  packKey: z.string(),
  groupKey: z.string(),
  suggestedPriceEtb: z.number().int().describe('Only a suggestion: the owner sets the real price'),
  alreadyAdded: z.boolean(),
});

const errors = {
  400: errorResponseSchema.describe('VALIDATION_ERROR'),
  401: errorResponseSchema.describe('UNAUTHORIZED'),
  402: errorResponseSchema.describe('SUBSCRIPTION_REQUIRED (restaurant plan only)'),
  403: errorResponseSchema.describe('FORBIDDEN (writes and catalog: owner and manager only)'),
};
const notFound = { 404: errorResponseSchema.describe('NOT_FOUND') };
const duplicate = { 409: errorResponseSchema.describe('MENU_DUPLICATE') };
const categoryConflict = {
  409: errorResponseSchema.describe('CATEGORY_DUPLICATE or CATEGORY_NOT_EMPTY'),
};

const optionalIdempotencyKey = z.object({
  'idempotency-key': z.string().min(8).max(100).optional().describe('A new UUID per user action'),
});

/** Restaurant Plus menu: everyone reads it; owner and manager edit it and use the starter packs. */
export const menuRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', requireRestaurantPlan);
  const menu = createMenuService(app.prisma);
  const editors = requireRoles('owner', 'manager');
  const security = [{ bearerAuth: [] }];

  // ─── Menu ──────────────────────────────────────────────────────────────────

  app.get(
    '/menu',
    {
      schema: {
        tags: ['menu'],
        security,
        description:
          'Owner and manager: every item that is not deleted, with its on/off flag. Waiter and ' +
          'chef: only items that are on. Sorted by category, groupName, sortOrder, name.',
        response: { 200: z.array(menuItemSchema), ...errors },
      },
    },
    async (request) => menu.list(request.auth)
  );

  // ─── Categories ────────────────────────────────────────────────────────────

  app.get(
    '/menu/categories',
    {
      schema: {
        tags: ['menu'],
        security,
        description:
          'The business menu categories ("Hot drinks", "Fast food"…) in the owner’s order. ' +
          'A new business starts with Food, Drinks and Combos.',
        response: { 200: z.array(itemCategorySchema), ...errors },
      },
    },
    async (request) => menu.listCategories(request.auth)
  );

  app.post(
    '/menu/categories',
    {
      preHandler: editors,
      schema: {
        tags: ['menu'],
        security,
        description:
          'Add a category at the end. A name already used (ignoring case and spaces) gives ' +
          'CATEGORY_DUPLICATE.',
        body: z.object({
          name: categoryNameSchema,
          nameAm: categoryNameSchema.optional(),
          kind: categorySchema.optional().describe('Default food; only starter packs use it'),
        }),
        response: { 201: itemCategorySchema, ...errors, ...categoryConflict },
      },
    },
    async (request, reply) =>
      reply.status(201).send(await menu.addCategory(request.auth, request.body))
  );

  app.patch(
    '/menu/categories/:id',
    {
      preHandler: editors,
      schema: {
        tags: ['menu'],
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
        response: { 200: itemCategorySchema, ...errors, ...notFound, ...categoryConflict },
      },
    },
    async (request) => menu.updateCategory(request.auth, request.params.id, request.body)
  );

  app.delete(
    '/menu/categories/:id',
    {
      preHandler: editors,
      schema: {
        tags: ['menu'],
        security,
        description:
          'Delete an empty category. One with items gives CATEGORY_NOT_EMPTY: move or delete ' +
          'its items first.',
        params: idParamSchema,
        response: { 204: z.null(), ...errors, ...notFound, ...categoryConflict },
      },
    },
    async (request, reply) => {
      await menu.removeCategory(request.auth, request.params.id);
      return reply.status(204).send(null);
    }
  );

  app.post(
    '/menu',
    {
      preHandler: editors,
      schema: {
        tags: ['menu'],
        security,
        description:
          'Add an item by hand (turned on, at the end of its category). A name already on the ' +
          'menu (ignoring case and spaces) gives MENU_DUPLICATE. Repeating an Idempotency-Key ' +
          'returns the first item.',
        headers: optionalIdempotencyKey,
        body: z.object({
          name: nameSchema,
          nameAm: nameAmSchema.optional(),
          categoryId: idSchema.optional().describe('One of GET /menu/categories'),
          category: categorySchema.optional().describe('Used only when categoryId is missing'),
          priceEtb: priceSchema,
          groupName: groupNameSchema.optional(),
        }),
        response: { 201: menuItemSchema, ...errors, ...duplicate },
      },
    },
    async (request, reply) =>
      reply
        .status(201)
        .send(await menu.add(request.auth, request.body, request.headers['idempotency-key']))
  );

  app.patch(
    '/menu/:id',
    {
      preHandler: editors,
      schema: {
        tags: ['menu'],
        security,
        description:
          'Change name, Amharic name (null clears it), category, price, on/off or position. ' +
          'Past orders keep their own copy of name and price.',
        params: idParamSchema,
        body: z
          .object({
            name: nameSchema.optional(),
            nameAm: nameAmSchema.nullable().optional(),
            categoryId: idSchema.optional(),
            category: categorySchema.optional(),
            priceEtb: priceSchema.optional(),
            active: z.boolean().optional(),
            sortOrder: z.number().int().min(0).max(100_000).optional(),
          })
          .refine((b) => Object.values(b).some((v) => v !== undefined), {
            message: 'Nothing to change',
          }),
        response: { 200: menuItemSchema, ...errors, ...notFound, ...duplicate },
      },
    },
    async (request) => menu.update(request.auth, request.params.id, request.body)
  );

  app.delete(
    '/menu/:id',
    {
      preHandler: editors,
      schema: {
        tags: ['menu'],
        security,
        description:
          'Soft delete: the item disappears from the menu and can no longer be ordered. ' +
          'Past orders keep their copies.',
        params: idParamSchema,
        response: { 204: z.null(), ...errors, ...notFound },
      },
    },
    async (request, reply) => {
      await menu.remove(request.auth, request.params.id);
      return reply.status(204).send(null);
    }
  );

  app.post(
    '/menu/bulk-delete',
    {
      preHandler: editors,
      schema: {
        tags: ['menu'],
        security,
        description: 'Soft-deletes several items. All or nothing (an unknown id deletes nothing).',
        body: z.object({ ids: idsSchema }),
        response: { 200: z.object({ deleted: z.number().int() }), ...errors, ...notFound },
      },
    },
    async (request) => menu.bulkDelete(request.auth, request.body.ids)
  );

  app.post(
    '/menu/bulk-price',
    {
      preHandler: editors,
      schema: {
        tags: ['menu'],
        security,
        description:
          'One of: exact prices `{ updates: [{ id, priceEtb }] }`; a percent change for chosen ' +
          'items `{ ids, percent }`; or a percent change for a whole section ' +
          '`{ groupName, category?, percent }`. Percent: -50..200, rounded to the nearest 5 ETB, ' +
          'at least 1. All or nothing: an unknown id, an empty section (NOT_FOUND) or a price ' +
          'above 1,000,000 changes nothing.',
        body: z.union([
          z.object({
            updates: z
              .array(z.object({ id: idSchema, priceEtb: priceSchema }))
              .min(1)
              .max(200),
          }),
          z.object({ ids: idsSchema, percent: percentSchema }),
          z.object({
            groupName: groupNameSchema,
            category: categorySchema.optional(),
            percent: percentSchema,
          }),
        ]),
        response: { 200: z.array(menuItemSchema), ...errors, ...notFound },
      },
    },
    async (request) => menu.bulkPrice(request.auth, request.body)
  );

  app.post(
    '/menu/bulk-availability',
    {
      preHandler: editors,
      schema: {
        tags: ['menu'],
        security,
        description:
          'Turn several items on or off, e.g. after importing with activate=false. All or ' +
          'nothing (an unknown id changes nothing).',
        body: z.object({ ids: idsSchema, active: z.boolean() }),
        response: { 200: z.array(menuItemSchema), ...errors, ...notFound },
      },
    },
    async (request) => menu.bulkAvailability(request.auth, request.body.ids, request.body.active)
  );

  // ─── Starter packs ─────────────────────────────────────────────────────────

  app.get(
    '/menu/catalog/packs',
    {
      preHandler: editors,
      schema: {
        tags: ['menu catalog'],
        security,
        description:
          'Starter menus by restaurant type and their sections. addedCount = items this ' +
          'business already has (same catalog item or same name).',
        response: { 200: z.array(packSchema), ...errors },
      },
    },
    async (request) => menu.packs(request.auth)
  );

  app.get(
    '/menu/catalog',
    {
      preHandler: editors,
      schema: {
        tags: ['menu catalog'],
        security,
        description: 'Starter-pack items (no alcohol, no pork), filtered.',
        querystring: z.object({
          pack: keySchema.optional(),
          group: keySchema.optional(),
          category: categorySchema.optional(),
          q: z
            .string()
            .trim()
            .max(60)
            .optional()
            .describe('Search in the English and Amharic name'),
        }),
        response: { 200: z.array(catalogItemSchema), ...errors },
      },
    },
    async (request) => menu.catalog(request.auth, request.query)
  );

  app.post(
    '/menu/catalog/import',
    {
      preHandler: editors,
      schema: {
        tags: ['menu catalog'],
        security,
        description:
          'Add whole packs, whole sections and single items in one request (one transaction). ' +
          'Selection = items of `packs` + items of `groups` + `items`, minus `exclude`; it must ' +
          `be 1..${MAX_IMPORT_ITEMS} items. Price: items[].priceEtb or the suggested price; ` +
          'name override only for items[]. activate=false adds them turned off, so prices can be ' +
          'set first. Items already on the menu are skipped (ALREADY_ADDED), so importing again ' +
          'is safe. An unknown pack, section or key fails everything (VALIDATION_ERROR).',
        headers: optionalIdempotencyKey,
        body: z.object({
          packs: z.array(keySchema).max(20).optional(),
          groups: z
            .array(z.object({ pack: keySchema, group: keySchema }))
            .max(100)
            .optional(),
          items: z
            .array(
              z.object({
                key: keySchema,
                priceEtb: priceSchema.optional(),
                name: z.string().trim().min(1).max(60).optional(),
              })
            )
            .max(MAX_IMPORT_ITEMS)
            .optional(),
          exclude: z.array(keySchema).max(MAX_IMPORT_ITEMS).optional(),
          activate: z.boolean().default(true),
        }),
        response: {
          200: z.object({
            created: z.array(menuItemSchema),
            skipped: z.array(z.object({ key: z.string(), reason: z.literal('ALREADY_ADDED') })),
            totalCreated: z.number().int(),
          }),
          ...errors,
        },
      },
    },
    async (request) => menu.importCatalog(request.auth, request.body)
  );
};
