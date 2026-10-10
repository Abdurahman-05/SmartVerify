import { Prisma, type MenuCategory, type PrismaClient } from '../../generated/prisma/client.js';
import type { AuthContext } from '../../plugins/auth.js';
import { AppError } from '../../shared/errors/app-error.js';

import { CATALOG, catalogByKey, type CatalogGroup } from './catalog.js';

export const MAX_PRICE_ETB = 1_000_000;

/** What the API returns for a menu item. */
export const menuItemSelect = {
  id: true,
  name: true,
  nameAm: true,
  priceEtb: true,
  category: true,
  active: true,
  sortOrder: true,
} as const;

/** Names are compared ignoring case and spaces ("Doro wat" = "doro  WAT" = "DoroWat"). */
export const normalizeName = (name: string) => name.toLowerCase().replace(/\s+/g, '');

const canSeeOff = (auth: AuthContext) => auth.role === 'owner' || auth.role === 'manager';

/** Which unique index a P2002 came from (index name or columns, as Postgres reports them). */
function uniqueViolation(error: unknown): string | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002')
    return null;
  return JSON.stringify(error.meta ?? {});
}

const notDeleted = (businessId: string) => ({ businessId, deletedAt: null });

/** Next sortOrder at the end of a category. */
async function nextSortOrder(
  tx: Prisma.TransactionClient,
  businessId: string,
  category: MenuCategory
) {
  const { _max } = await tx.menuItem.aggregate({
    where: { businessId, category },
    _max: { sortOrder: true },
  });
  return (_max.sortOrder ?? -1) + 1;
}

export interface NewMenuItem {
  name: string;
  nameAm?: string;
  category: MenuCategory;
  priceEtb: number;
}

export interface MenuItemChanges {
  name?: string;
  nameAm?: string | null;
  category?: MenuCategory;
  priceEtb?: number;
  active?: boolean;
  sortOrder?: number;
}

export type BulkPriceInput =
  { updates: { id: string; priceEtb: number }[] } | { ids: string[]; percent: number };

export interface ImportInput {
  items: { key: string; priceEtb?: number; name?: string }[];
}

export interface CatalogFilters {
  category?: MenuCategory;
  group?: CatalogGroup;
  q?: string;
}

/** Percent price change, rounded to the nearest 5 ETB, never below 1 ETB. */
export const applyPercent = (priceEtb: number, percent: number) =>
  Math.max(1, Math.round((priceEtb * (100 + percent)) / 100 / 5) * 5);

export function createMenuService(prisma: PrismaClient) {
  /** Throws MENU_DUPLICATE when another (non-deleted) item already has this name. */
  async function assertNameFree(
    db: Prisma.TransactionClient | PrismaClient,
    businessId: string,
    name: string,
    exceptId?: string
  ) {
    const items = await db.menuItem.findMany({
      where: { ...notDeleted(businessId), ...(exceptId && { id: { not: exceptId } }) },
      select: { name: true },
    });
    const wanted = normalizeName(name);
    if (items.some((item) => normalizeName(item.name) === wanted)) {
      throw new AppError('MENU_DUPLICATE');
    }
  }

  // In add/update (after the idempotency replay check) the only unique index left to violate is
  // MenuItem_name_active_unique: two people saving the same name at the same moment.
  const mapNameViolation = (error: unknown) =>
    uniqueViolation(error) ? new AppError('MENU_DUPLICATE') : error;

  return {
    /** Owner/manager: every non-deleted item. Waiter/chef: only items that are on. */
    list(auth: AuthContext) {
      return prisma.menuItem.findMany({
        where: { ...notDeleted(auth.businessId), ...(!canSeeOff(auth) && { active: true }) },
        orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
        select: menuItemSelect,
      });
    },

    /** Manual add. A repeated Idempotency-Key returns the first item. */
    async add(auth: AuthContext, input: NewMenuItem, idempotencyKey?: string) {
      const { businessId } = auth;
      const replay = () =>
        idempotencyKey
          ? prisma.menuItem.findUnique({
              where: { businessId_idempotencyKey: { businessId, idempotencyKey } },
              select: menuItemSelect,
            })
          : Promise.resolve(null);

      const existing = await replay();
      if (existing) return existing;
      try {
        return await prisma.$transaction(async (tx) => {
          await assertNameFree(tx, businessId, input.name);
          return tx.menuItem.create({
            data: {
              ...input,
              businessId,
              idempotencyKey: idempotencyKey ?? null,
              sortOrder: await nextSortOrder(tx, businessId, input.category),
            },
            select: menuItemSelect,
          });
        });
      } catch (error) {
        // The same add arrived twice at once (the first one may also make the name a "duplicate").
        const winner = await replay();
        if (winner) return winner;
        throw mapNameViolation(error);
      }
    },

    async update(auth: AuthContext, id: string, changes: MenuItemChanges) {
      const { businessId } = auth;
      const item = await prisma.menuItem.findFirst({
        where: { id, ...notDeleted(businessId) },
        select: { id: true },
      });
      if (!item) throw new AppError('NOT_FOUND');
      try {
        if (changes.name !== undefined) await assertNameFree(prisma, businessId, changes.name, id);
        return await prisma.menuItem.update({
          where: { id },
          data: changes,
          select: menuItemSelect,
        });
      } catch (error) {
        throw mapNameViolation(error);
      }
    },

    /** Soft delete: hidden everywhere and never available again; order history is untouched. */
    async remove(auth: AuthContext, id: string) {
      const { count } = await prisma.menuItem.updateMany({
        where: { id, ...notDeleted(auth.businessId) },
        data: { deletedAt: new Date(), active: false },
      });
      if (count === 0) throw new AppError('NOT_FOUND');
    },

    /** All or nothing: an unknown id or an out-of-range result changes no price. */
    async bulkPrice(auth: AuthContext, input: BulkPriceInput) {
      const { businessId } = auth;
      const ids = 'updates' in input ? input.updates.map((u) => u.id) : input.ids;
      if (new Set(ids).size !== ids.length) {
        throw new AppError('VALIDATION_ERROR', { reason: 'duplicateIds' });
      }

      return prisma.$transaction(
        async (tx) => {
          const items = await tx.menuItem.findMany({
            where: { id: { in: ids }, ...notDeleted(businessId) },
            select: { id: true, priceEtb: true },
          });
          const found = new Map(items.map((i) => [i.id, i.priceEtb]));
          const missing = ids.filter((id) => !found.has(id));
          if (missing.length) throw new AppError('NOT_FOUND', { ids: missing });

          const newPrices =
            'updates' in input
              ? input.updates
              : input.ids.map((id) => ({
                  id,
                  priceEtb: applyPercent(found.get(id) ?? 0, input.percent),
                }));
          if (newPrices.some((p) => p.priceEtb > MAX_PRICE_ETB)) {
            throw new AppError('VALIDATION_ERROR', { reason: 'priceTooHigh' });
          }

          for (const { id, priceEtb } of newPrices) {
            await tx.menuItem.update({ where: { id }, data: { priceEtb } });
          }
          return tx.menuItem.findMany({
            where: { id: { in: ids } },
            orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
            select: menuItemSelect,
          });
        },
        { maxWait: 10_000, timeout: 60_000 }
      );
    },

    /** Turn several items on or off at once. All or nothing. */
    async bulkAvailability(auth: AuthContext, ids: string[], active: boolean) {
      const { businessId } = auth;
      const unique = [...new Set(ids)];
      return prisma.$transaction(async (tx) => {
        const { count } = await tx.menuItem.updateMany({
          where: { id: { in: unique }, ...notDeleted(businessId) },
          data: { active },
        });
        if (count !== unique.length) {
          // Rolls back the update above.
          throw new AppError('NOT_FOUND');
        }
        return tx.menuItem.findMany({
          where: { id: { in: unique } },
          orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
          select: menuItemSelect,
        });
      });
    },

    /** The sample catalog, filtered, with whether each entry is already on this menu. */
    async catalog(auth: AuthContext, filters: CatalogFilters) {
      const existing = await prisma.menuItem.findMany({
        where: notDeleted(auth.businessId),
        select: { name: true, catalogKey: true },
      });
      const keys = new Set(existing.map((i) => i.catalogKey).filter(Boolean));
      const names = new Set(existing.map((i) => normalizeName(i.name)));
      const q = filters.q?.trim().toLowerCase();

      return CATALOG.filter(
        (item) =>
          (!filters.category || item.category === filters.category) &&
          (!filters.group || item.group === filters.group) &&
          (!q ||
            item.name.toLowerCase().includes(q) ||
            item.nameAm.includes(q) ||
            item.key.includes(q))
      ).map((item, index) => ({
        ...item,
        sortOrder: index,
        alreadyAdded: keys.has(item.key) || names.has(normalizeName(item.name)),
      }));
    },

    /**
     * Adds catalog entries in one transaction. Entries already on the menu (same catalog key or
     * same name) are skipped and reported, so importing twice is safe.
     */
    async importCatalog(auth: AuthContext, input: ImportInput) {
      const unknownKeys = input.items.map((i) => i.key).filter((key) => !catalogByKey.has(key));
      if (unknownKeys.length) throw new AppError('VALIDATION_ERROR', { unknownKeys });

      const run = () =>
        prisma.$transaction(
          async (tx) => {
            const { businessId } = auth;
            const existing = await tx.menuItem.findMany({
              where: notDeleted(businessId),
              select: { name: true, catalogKey: true },
            });
            const keys = new Set(existing.map((i) => i.catalogKey).filter(Boolean));
            const names = new Set(existing.map((i) => normalizeName(i.name)));
            const nextOrder = new Map<MenuCategory, number>();

            const toCreate: Prisma.MenuItemCreateManyInput[] = [];
            const skipped: { key: string; reason: 'ALREADY_ADDED' }[] = [];
            for (const wanted of input.items) {
              const entry = catalogByKey.get(wanted.key);
              if (!entry) continue; // checked above
              const name = wanted.name ?? entry.name;
              if (keys.has(entry.key) || names.has(normalizeName(name))) {
                skipped.push({ key: wanted.key, reason: 'ALREADY_ADDED' });
                continue;
              }
              keys.add(entry.key);
              names.add(normalizeName(name));

              const sortOrder =
                nextOrder.get(entry.category) ??
                (await nextSortOrder(tx, businessId, entry.category));
              nextOrder.set(entry.category, sortOrder + 1);
              toCreate.push({
                businessId,
                name,
                nameAm: entry.nameAm,
                category: entry.category,
                priceEtb: wanted.priceEtb ?? entry.suggestedPriceEtb,
                catalogKey: entry.key,
                sortOrder,
              });
            }

            const created = toCreate.length
              ? await tx.menuItem.createManyAndReturn({ data: toCreate, select: menuItemSelect })
              : [];
            return { created, skipped };
          },
          { maxWait: 10_000, timeout: 60_000 }
        );

      try {
        return await run();
      } catch (error) {
        // A parallel import added some of the same items first: run again, they are now skipped.
        if (uniqueViolation(error)) return run();
        throw error;
      }
    },
  };
}
