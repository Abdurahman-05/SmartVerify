import { addMenuItem, getMenuItems, type MenuAdminItem } from './menu';
import { mockDelay } from './mock';
import type { MenuCategory } from './restaurant';

/** A starter menu (restaurant type) with its sections and how much of it is already added. */
export interface CatalogPack {
  key: string;
  name: string;
  nameAm: string;
  itemCount: number;
  addedCount: number;
  groups: CatalogSection[];
}

export interface CatalogSection {
  key: string;
  name: string;
  nameAm: string;
  category: MenuCategory;
  itemCount: number;
  addedCount: number;
}

export interface CatalogItem {
  key: string;
  name: string;
  nameAm: string;
  category: MenuCategory;
  packKey: string;
  groupKey: string;
  /** Only a suggestion: the owner sets the real price. */
  suggestedPriceEtb: number;
  alreadyAdded: boolean;
}

export interface CatalogImportInput {
  packs?: string[];
  groups?: { pack: string; group: string }[];
  items?: { key: string; priceEtb?: number; name?: string }[];
  exclude?: string[];
  /** false = add them turned off, to set prices first. */
  activate?: boolean;
}

export interface CatalogImportResult {
  created: MenuAdminItem[];
  skipped: { key: string; reason: 'ALREADY_ADDED' }[];
  totalCreated: number;
}

// A small offline sample; the real list (7 packs, ~180 items) comes from the server.
type Row = [key: string, name: string, nameAm: string, priceEtb: number];
const data: {
  key: string;
  name: string;
  nameAm: string;
  groups: { key: string; name: string; nameAm: string; category: MenuCategory; items: Row[] }[];
}[] = [
  {
    key: 'ethiopian-traditional',
    name: 'Ethiopian Traditional',
    nameAm: 'የኢትዮጵያ ባህላዊ',
    groups: [
      {
        key: 'meat-tibs',
        name: 'Meat & Tibs',
        nameAm: 'ሥጋ እና ጥብስ',
        category: 'food',
        items: [
          ['doro-wat', 'Doro Wat', 'ዶሮ ወጥ', 450],
          ['tibs', 'Tibs', 'ጥብስ', 400],
          ['shekla-tibs', 'Shekla Tibs', 'ሸክላ ጥብስ', 520],
        ],
      },
      {
        key: 'raw-kitfo',
        name: 'Raw & Kitfo',
        nameAm: 'ጥሬ እና ክትፎ',
        category: 'food',
        items: [
          ['kitfo', 'Kitfo', 'ክትፎ', 550],
          ['gored-gored', 'Gored Gored', 'ጎረድ ጎረድ', 500],
        ],
      },
    ],
  },
  {
    key: 'drinks',
    name: 'Drinks',
    nameAm: 'መጠጦች',
    groups: [
      {
        key: 'soft-drinks',
        name: 'Soft Drinks',
        nameAm: 'ለስላሳ መጠጦች',
        category: 'drinks',
        items: [
          ['coca-cola', 'Coca-Cola', 'ኮካ ኮላ', 50],
          ['fanta', 'Fanta', 'ፋንታ', 50],
        ],
      },
      {
        key: 'juice',
        name: 'Juice',
        nameAm: 'ጭማቂ',
        category: 'drinks',
        items: [
          ['avocado-juice', 'Avocado Juice', 'የአቮካዶ ጭማቂ', 120],
          ['mango-juice', 'Mango Juice', 'የማንጎ ጭማቂ', 120],
        ],
      },
    ],
  },
];

const allItems = () =>
  data.flatMap((pack) =>
    pack.groups.flatMap((group) =>
      group.items.map(([key, name, nameAm, suggestedPriceEtb]) => ({
        key,
        name,
        nameAm,
        suggestedPriceEtb,
        category: group.category,
        packKey: pack.key,
        groupKey: group.key,
        groupName: group.name,
      }))
    )
  );

const normalize = (name: string) => name.toLowerCase().replace(/\s+/g, '');
const addedNames = async () => new Set((await getMenuItems()).map((i) => normalize(i.name)));

export async function getCatalogPacks(): Promise<CatalogPack[]> {
  await mockDelay(300);
  const added = await addedNames();
  return data.map((pack) => {
    const groups = pack.groups.map((g) => ({
      key: g.key,
      name: g.name,
      nameAm: g.nameAm,
      category: g.category,
      itemCount: g.items.length,
      addedCount: g.items.filter(([, name]) => added.has(normalize(name))).length,
    }));
    return {
      key: pack.key,
      name: pack.name,
      nameAm: pack.nameAm,
      itemCount: groups.reduce((s, g) => s + g.itemCount, 0),
      addedCount: groups.reduce((s, g) => s + g.addedCount, 0),
      groups,
    };
  });
}

export async function getCatalogItems(filters: { pack?: string } = {}): Promise<CatalogItem[]> {
  await mockDelay(300);
  const added = await addedNames();
  return allItems()
    .filter((i) => !filters.pack || i.packKey === filters.pack)
    .map(({ groupName: _groupName, ...i }) => ({
      ...i,
      alreadyAdded: added.has(normalize(i.name)),
    }));
}

export async function importCatalog(
  input: CatalogImportInput,
  _idempotencyKey?: string
): Promise<CatalogImportResult> {
  const items = allItems();
  const keys = new Set([
    ...(input.packs ?? []).flatMap((p) => items.filter((i) => i.packKey === p).map((i) => i.key)),
    ...(input.groups ?? []).flatMap((g) =>
      items.filter((i) => i.packKey === g.pack && i.groupKey === g.group).map((i) => i.key)
    ),
    ...(input.items ?? []).map((i) => i.key),
  ]);
  (input.exclude ?? []).forEach((k) => keys.delete(k));

  const added = await addedNames();
  const created: MenuAdminItem[] = [];
  const skipped: CatalogImportResult['skipped'] = [];
  for (const item of items.filter((i) => keys.has(i.key))) {
    if (added.has(normalize(item.name))) {
      skipped.push({ key: item.key, reason: 'ALREADY_ADDED' });
      continue;
    }
    const row = await addMenuItem({
      name: item.name,
      priceEtb: item.suggestedPriceEtb,
      category: item.category,
    });
    created.push({
      ...row,
      nameAm: item.nameAm,
      groupName: item.groupName,
      active: input.activate ?? true,
    });
    added.add(normalize(item.name));
  }
  return { created, skipped, totalCreated: created.length };
}
