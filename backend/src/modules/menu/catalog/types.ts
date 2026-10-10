/**
 * Starter menus by restaurant type. Data only.
 *
 * Hard rules (enforced by tests): NO alcoholic drinks and NO pork, under any name; every item key
 * is globally unique and never renamed (imported menu items keep it in MenuItem.catalogKey);
 * names are 1..60 characters and unique across all packs.
 *
 * suggestedPriceEtb values are ONLY suggestions (plausible mid-range Addis Ababa prices, integer
 * ETB). The owner edits them while importing or afterwards.
 */

export type CatalogCategory = 'food' | 'drinks' | 'combos';

export interface CatalogItem {
  key: string;
  name: string;
  nameAm: string;
  suggestedPriceEtb: number;
}

export interface CatalogGroup {
  /** Unique inside its pack. */
  key: string;
  name: string;
  nameAm: string;
  category: CatalogCategory;
  items: CatalogItem[];
}

export interface CatalogPack {
  key: string;
  name: string;
  nameAm: string;
  groups: CatalogGroup[];
}

/** Compact item row: key, English name, Amharic name, suggested price (ETB). */
export const item = (
  key: string,
  name: string,
  nameAm: string,
  suggestedPriceEtb: number
): CatalogItem => ({ key, name, nameAm, suggestedPriceEtb });
