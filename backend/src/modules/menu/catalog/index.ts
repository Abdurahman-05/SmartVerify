import { arabMandi } from './arab-mandi.js';
import { cafeBakery } from './cafe-bakery.js';
import { drinks } from './drinks.js';
import { ethiopianEveryday } from './ethiopian-everyday.js';
import { ethiopianFasting } from './ethiopian-fasting.js';
import { ethiopianTraditional } from './ethiopian-traditional.js';
import { pizzaBurger } from './pizza-burger.js';
import type { CatalogCategory, CatalogItem, CatalogPack } from './types.js';

export type { CatalogCategory, CatalogGroup, CatalogItem, CatalogPack } from './types.js';

/** Starter packs, in the order the app shows them. */
export const PACKS: readonly CatalogPack[] = [
  ethiopianTraditional,
  ethiopianEveryday,
  ethiopianFasting,
  arabMandi,
  pizzaBurger,
  cafeBakery,
  drinks,
];

/** One item with where it lives (pack, group) and what it inherits from its group. */
export interface CatalogEntry extends CatalogItem {
  packKey: string;
  groupKey: string;
  groupName: string;
  category: CatalogCategory;
}

export const CATALOG_ITEMS: readonly CatalogEntry[] = PACKS.flatMap((pack) =>
  pack.groups.flatMap((group) =>
    group.items.map((item) => ({
      ...item,
      packKey: pack.key,
      groupKey: group.key,
      groupName: group.name,
      category: group.category,
    }))
  )
);

export const catalogItemByKey = new Map(CATALOG_ITEMS.map((item) => [item.key, item]));
export const packByKey = new Map(PACKS.map((pack) => [pack.key, pack]));
export const findGroup = (packKey: string, groupKey: string) =>
  packByKey.get(packKey)?.groups.find((group) => group.key === groupKey);
