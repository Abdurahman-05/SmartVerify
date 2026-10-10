import { Prisma, type MenuCategory, type PrismaClient } from '../../generated/prisma/client.js';
import type { AuthContext } from '../../plugins/auth.js';
import { AppError } from '../../shared/errors/app-error.js';

import {
  CATALOG_ITEMS,
  catalogItemByKey,
  findGroup,
  packByKey,
  PACKS,
  type CatalogEntry,
} from './catalog/index.js';

export const MAX_PRICE_ETB = 1_000_000;
/** Most catalog items one import may add. */
export const MAX_IMPORT_ITEMS = 300;

/** What the API returns for a menu item. */
export const menuItemSelect = {
  id: true,
  name: true,
  nameAm: true,
  priceEtb: true,
  category: true,
  groupName: true,
  active: true,
  sortOrder: true,
} as const;

const menuOrder: Prisma.MenuItemOrderByWithRelationInput[] = [
  { category: 'asc' },
  { groupName: 'asc' },
  { sortOrder: 'asc' },
  { name: 'asc' },
];

/** Names are compared ignoring case and spaces ("Doro wat" = "doro  WAT" = "DoroWat"). */
export const normalizeName = (name: string) => name.toLowerCase().replace(/\s+/g, '');

const canSeeOff = (auth: AuthContext) => auth.role === 'owner' || auth.role === 'manager';

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

const notDeleted = (businessId: string) => ({ businessId, deletedAt: null });

/** Percent price change, rounded to the nearest 5 ETB, never below 1 ETB. */
export const applyPercent = (priceEtb: number, percent: number) =>
  Math.max(1, Math.round((priceEtb * (100 + percent)) / 100 / 5) * 5);

export interface NewMenuItem {
  name: string;
  nameAm?: string;
  category: MenuCategory;
  priceEtb: number;
  groupName?: string;
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
  | { updates: { id: string; priceEtb: number }[] }
  | { ids: string[]; percent: number }
  | { groupName: string; category?: MenuCategory; percent: number };

export interface ImportInput {
  packs?: string[];
  groups?: { pack: string; group: string }[];
  items?: { key: string; priceEtb?: number; name?: string }[];
  exclude?: string[];
  activate?: boolean;
}

export interface CatalogFilters {
  pack?: string;
  group?: string;
  category?: MenuCategory;
  q?: string;
}

export function createMenuService(prisma: PrismaClient) {
  /** Catalog keys and normalized names already on this business's menu (deleted items excluded). */
  async function existingMenu(db: Prisma.TransactionClient | PrismaClient, businessId: string) {
    const items = await db.menuItem.findMany({
      where: notDeleted(businessId),
      select: { name: true, catalogKey: true },
    });
    const keys = new Set(items.flatMap((i) => (i.catalogKey ? [i.catalogKey] : [])));
    const names = new Set(items.map((i) => normalizeName(i.name)));
    return {
      keys,
      names,
      has: (entry: { key: string; name: string }) =>
        keys.has(entry.key) || names.has(normalizeName(entry.name)),
    };
  }

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

  /** Next sortOrder at the end of each category. */
  async function sortOrderCounter(tx: Prisma.TransactionClient, businessId: string) {
    const max = await tx.menuItem.groupBy({
      by: ['category'],
      where: { businessId },
      _max: { sortOrder: true },
    });
    const next = new Map(max.map((row) => [row.category, (row._max.sortOrder ?? -1) + 1]));
    return (category: MenuCategory) => {
      const value = next.get(category) ?? 0;
      next.set(category, value + 1);
      return value;
    };
  }

  // In add/update (after the idempotency replay check) the only unique index left to violate is
  // MenuItem_name_active_unique: two people saving the same name at the same moment.
  const mapNameViolation = (error: unknown) =>
    isUniqueViolation(error) ? new AppError('MENU_DUPLICATE') : error;

  const findAll = (db: Prisma.TransactionClient | PrismaClient, ids: string[]) =>
    db.menuItem.findMany({
      where: { id: { in: ids } },
      orderBy: menuOrder,
      select: menuItemSelect,
    });

  return {
    /** Owner/manager: every non-deleted item. Waiter/chef: only items that are on. */
    list(auth: AuthContext) {
      return prisma.menuItem.findMany({
        where: { ...notDeleted(auth.businessId), ...(!canSeeOff(auth) && { active: true }) },
        orderBy: menuOrder,
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
          const nextOrder = await sortOrderCounter(tx, businessId);
          return tx.menuItem.create({
            data: {
              ...input,
              businessId,
              idempotencyKey: idempotencyKey ?? null,
              sortOrder: nextOrder(input.category),
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

    /** Soft delete: hidden everywhere and never orderable again; order history is untouched. */
    async remove(auth: AuthContext, id: string) {
      const { count } = await prisma.menuItem.updateMany({
        where: { id, ...notDeleted(auth.businessId) },
        data: { deletedAt: new Date(), active: false },
      });
      if (count === 0) throw new AppError('NOT_FOUND');
    },

    /** Soft-deletes several items. All or nothing (an unknown id deletes nothing). */
    async bulkDelete(auth: AuthContext, ids: string[]) {
      const unique = [...new Set(ids)];
      await prisma.$transaction(async (tx) => {
        const { count } = await tx.menuItem.updateMany({
          where: { id: { in: unique }, ...notDeleted(auth.businessId) },
          data: { deletedAt: new Date(), active: false },
        });
        if (count !== unique.length) throw new AppError('NOT_FOUND'); // rolls back
      });
      return { deleted: unique.length };
    },

    /**
     * Exact prices, a percent change for chosen items, or a percent change for a whole section.
     * All or nothing: an unknown id or an out-of-range price changes nothing.
     */
    async bulkPrice(auth: AuthContext, input: BulkPriceInput) {
      const { businessId } = auth;
      if ('updates' in input || 'ids' in input) {
        const ids = 'updates' in input ? input.updates.map((u) => u.id) : input.ids;
        if (new Set(ids).size !== ids.length) {
          throw new AppError('VALIDATION_ERROR', { reason: 'duplicateIds' });
        }
      }

      return prisma.$transaction(
        async (tx) => {
          const where: Prisma.MenuItemWhereInput =
            'groupName' in input
              ? {
                  ...notDeleted(businessId),
                  groupName: input.groupName,
                  ...(input.category && { category: input.category }),
                }
              : {
                  ...notDeleted(businessId),
                  id: { in: 'updates' in input ? input.updates.map((u) => u.id) : input.ids },
                };
          const items = await tx.menuItem.findMany({ where, select: { id: true, priceEtb: true } });

          let newPrices: { id: string; priceEtb: number }[];
          if ('updates' in input) {
            const found = new Set(items.map((i) => i.id));
            const missing = input.updates.filter((u) => !found.has(u.id)).map((u) => u.id);
            if (missing.length) throw new AppError('NOT_FOUND', { ids: missing });
            newPrices = input.updates;
          } else {
            if ('ids' in input) {
              const found = new Set(items.map((i) => i.id));
              const missing = input.ids.filter((id) => !found.has(id));
              if (missing.length) throw new AppError('NOT_FOUND', { ids: missing });
            } else if (items.length === 0) {
              throw new AppError('NOT_FOUND', { groupName: input.groupName });
            }
            newPrices = items.map((i) => ({
              id: i.id,
              priceEtb: applyPercent(i.priceEtb, input.percent),
            }));
          }
          if (newPrices.some((p) => p.priceEtb > MAX_PRICE_ETB)) {
            throw new AppError('VALIDATION_ERROR', { reason: 'priceTooHigh' });
          }

          for (const { id, priceEtb } of newPrices) {
            await tx.menuItem.update({ where: { id }, data: { priceEtb } });
          }
          return findAll(
            tx,
            newPrices.map((p) => p.id)
          );
        },
        { maxWait: 10_000, timeout: 120_000 }
      );
    },

    /** Turn several items on or off at once (e.g. after an import with activate=false). */
    async bulkAvailability(auth: AuthContext, ids: string[], active: boolean) {
      const unique = [...new Set(ids)];
      return prisma.$transaction(async (tx) => {
        const { count } = await tx.menuItem.updateMany({
          where: { id: { in: unique }, ...notDeleted(auth.businessId) },
          data: { active },
        });
        if (count !== unique.length) throw new AppError('NOT_FOUND'); // rolls back
        return findAll(tx, unique);
      });
    },

    /** Every pack and section with how many of its items this business already has. */
    async packs(auth: AuthContext) {
      const menu = await existingMenu(prisma, auth.businessId);
      return PACKS.map((pack) => {
        const groups = pack.groups.map((group) => ({
          key: group.key,
          name: group.name,
          nameAm: group.nameAm,
          category: group.category,
          itemCount: group.items.length,
          addedCount: group.items.filter(menu.has).length,
        }));
        return {
          key: pack.key,
          name: pack.name,
          nameAm: pack.nameAm,
          itemCount: groups.reduce((sum, g) => sum + g.itemCount, 0),
          addedCount: groups.reduce((sum, g) => sum + g.addedCount, 0),
          groups,
        };
      });
    },

    /** Catalog items, filtered, with whether each one is already on this menu. */
    async catalog(auth: AuthContext, filters: CatalogFilters) {
      const menu = await existingMenu(prisma, auth.businessId);
      const q = filters.q?.trim().toLowerCase();
      return CATALOG_ITEMS.filter(
        (item) =>
          (!filters.pack || item.packKey === filters.pack) &&
          (!filters.group || item.groupKey === filters.group) &&
          (!filters.category || item.category === filters.category) &&
          (!q || item.name.toLowerCase().includes(q) || item.nameAm.includes(q))
      ).map((item) => ({
        key: item.key,
        name: item.name,
        nameAm: item.nameAm,
        category: item.category,
        packKey: item.packKey,
        groupKey: item.groupKey,
        suggestedPriceEtb: item.suggestedPriceEtb,
        alreadyAdded: menu.has(item),
      }));
    },

    /**
     * Adds whole packs, whole sections and single items in one transaction. Items already on the
     * menu (same catalog key or same name) are skipped and reported, so importing again is safe.
     */
    async importCatalog(auth: AuthContext, input: ImportInput) {
      // Resolve everything first: any unknown pack, section or key fails the whole request.
      const unknown: Record<string, string[]> = {};
      const note = (kind: string, value: string) => (unknown[kind] ??= []).push(value);
      const selected = new Map<string, CatalogEntry>();
      const add = (key: string) => {
        const entry = catalogItemByKey.get(key);
        if (entry) selected.set(key, entry);
      };

      for (const packKey of input.packs ?? []) {
        const pack = packByKey.get(packKey);
        if (!pack) note('packs', packKey);
        pack?.groups.forEach((g) => g.items.forEach((i) => add(i.key)));
      }
      for (const { pack, group } of input.groups ?? []) {
        const found = findGroup(pack, group);
        if (!found) note('groups', `${pack}/${group}`);
        found?.items.forEach((i) => add(i.key));
      }
      const overrides = new Map<string, { priceEtb?: number; name?: string }>();
      for (const wanted of input.items ?? []) {
        if (!catalogItemByKey.has(wanted.key)) note('items', wanted.key);
        add(wanted.key);
        overrides.set(wanted.key, { ...overrides.get(wanted.key), ...wanted });
      }
      for (const key of input.exclude ?? []) {
        if (!catalogItemByKey.has(key)) note('exclude', key);
        selected.delete(key);
      }
      if (Object.keys(unknown).length) throw new AppError('VALIDATION_ERROR', { unknown });
      if (selected.size < 1 || selected.size > MAX_IMPORT_ITEMS) {
        throw new AppError('VALIDATION_ERROR', { reason: 'itemCount', count: selected.size });
      }
      const active = input.activate ?? true;

      const run = () =>
        prisma.$transaction(
          async (tx) => {
            const { businessId } = auth;
            const menu = await existingMenu(tx, businessId);
            const nextOrder = await sortOrderCounter(tx, businessId);

            const toCreate: Prisma.MenuItemCreateManyInput[] = [];
            const skipped: { key: string; reason: 'ALREADY_ADDED' }[] = [];
            for (const entry of selected.values()) {
              const override = overrides.get(entry.key);
              const name = override?.name ?? entry.name;
              if (menu.has({ key: entry.key, name })) {
                skipped.push({ key: entry.key, reason: 'ALREADY_ADDED' });
                continue;
              }
              menu.keys.add(entry.key);
              menu.names.add(normalizeName(name));
              toCreate.push({
                businessId,
                name,
                nameAm: entry.nameAm,
                category: entry.category,
                groupName: entry.groupName,
                priceEtb: override?.priceEtb ?? entry.suggestedPriceEtb,
                catalogKey: entry.key,
                active,
                sortOrder: nextOrder(entry.category),
              });
            }

            const created = toCreate.length
              ? await tx.menuItem.createManyAndReturn({ data: toCreate, select: menuItemSelect })
              : [];
            return { created, skipped, totalCreated: created.length };
          },
          { maxWait: 10_000, timeout: 60_000 }
        );

      try {
        return await run();
      } catch (error) {
        // A parallel import added some of the same items first: run again, they are now skipped.
        if (isUniqueViolation(error)) return run();
        throw error;
      }
    },
  };
}
