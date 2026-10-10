import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { requireRestaurantPlan, requireRoles } from '../../plugins/auth.js';
import { errorResponseSchema, idParamSchema } from '../../shared/schemas/common.js';

import { catalogGroups } from './catalog.js';
import { createMenuService, MAX_PRICE_ETB } from './menu.service.js';

const categorySchema = z.enum(['food', 'drinks', 'combos']);
const groupSchema = z.enum([
  ...catalogGroups.food,
  ...catalogGroups.drinks,
  ...catalogGroups.combos,
]);
const nameSchema = z.string().trim().min(1).max(80);
const nameAmSchema = z.string().trim().min(1).max(80);
/** Integer ETB. */
const priceSchema = z.number().int().min(1).max(MAX_PRICE_ETB);
const idSchema = z.string().min(1).max(64);
const idsSchema = z.array(idSchema).min(1).max(100);

const menuItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  nameAm: z.string().nullable(),
  priceEtb: z.number().int(),
  category: categorySchema,
  active: z.boolean().describe('false = "Finished today": hidden from New order'),
  sortOrder: z.number().int(),
});

const catalogItemSchema = z.object({
  key: z.string().describe('Stable slug, e.g. "doro-wat"'),
  name: z.string(),
  nameAm: z.string(),
  category: categorySchema,
  group: groupSchema.describe('Code; the app translates it'),
  suggestedPriceEtb: z.number().int().describe('Only a suggestion: the owner sets the real price'),
  sortOrder: z.number().int(),
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

const optionalIdempotencyKey = z.object({
  'idempotency-key': z.string().min(8).max(100).optional().describe('A new UUID per user action'),
});

/** Restaurant Plus menu: everyone reads it; owner and manager edit it and import the catalog. */
export const menuRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', requireRestaurantPlan);
  const menu = createMenuService(app.prisma);
  const editors = requireRoles('owner', 'manager');
  const security = [{ bearerAuth: [] }];

  app.get(
    '/menu',
    {
      schema: {
        tags: ['menu'],
        security,
        description:
          'Owner and manager: every item that is not deleted, with its on/off flag. Waiter and ' +
          'chef: only items that are on. Sorted by category, sortOrder, name.',
        response: { 200: z.array(menuItemSchema), ...errors },
      },
    },
    async (request) => menu.list(request.auth)
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
          category: categorySchema,
          priceEtb: priceSchema,
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
    '/menu/bulk-price',
    {
      preHandler: editors,
      schema: {
        tags: ['menu'],
        security,
        description:
          'Either exact prices `{ updates: [{ id, priceEtb }] }` or a percent change ' +
          '`{ ids, percent }` (-50..200, rounded to the nearest 5 ETB, at least 1). All or nothing: ' +
          'an unknown id (NOT_FOUND) or a price above 1,000,000 changes nothing.',
        body: z.union([
          z.object({
            updates: z
              .array(z.object({ id: idSchema, priceEtb: priceSchema }))
              .min(1)
              .max(100),
          }),
          z.object({ ids: idsSchema, percent: z.number().min(-50).max(200) }),
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
          'Turn several items on or off. All or nothing (an unknown id changes nothing).',
        body: z.object({ ids: idsSchema, active: z.boolean() }),
        response: { 200: z.array(menuItemSchema), ...errors, ...notFound },
      },
    },
    async (request) => menu.bulkAvailability(request.auth, request.body.ids, request.body.active)
  );

  app.get(
    '/menu/catalog',
    {
      preHandler: editors,
      schema: {
        tags: ['menu'],
        security,
        description:
          'Sample Ethiopian menu to import from (no alcoholic drinks). `alreadyAdded` = this ' +
          'business has an item from this entry or with the same name.',
        querystring: z.object({
          category: categorySchema.optional(),
          group: groupSchema.optional(),
          q: z.string().trim().max(60).optional().describe('Search in name, Amharic name and key'),
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
        tags: ['menu'],
        security,
        description:
          'Adds catalog entries in one transaction, using the suggested price unless priceEtb is ' +
          'given and the catalog name unless name is given. Entries already on the menu are ' +
          'skipped (ALREADY_ADDED), so sending the same import again is safe. An unknown key ' +
          'fails the whole request (VALIDATION_ERROR) and creates nothing.',
        headers: optionalIdempotencyKey,
        body: z.object({
          items: z
            .array(
              z.object({
                key: z.string().min(1).max(60),
                priceEtb: priceSchema.optional(),
                name: z.string().trim().min(1).max(60).optional(),
              })
            )
            .min(1)
            .max(100),
        }),
        response: {
          200: z.object({
            created: z.array(menuItemSchema),
            skipped: z.array(z.object({ key: z.string(), reason: z.literal('ALREADY_ADDED') })),
          }),
          ...errors,
        },
      },
    },
    async (request) => menu.importCatalog(request.auth, request.body)
  );
};
