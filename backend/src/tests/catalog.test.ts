import { describe, expect, it } from 'vitest';

import { CATALOG_ITEMS, PACKS } from '../modules/menu/catalog/index.js';
import { applyPercent, normalizeName } from '../modules/menu/menu.service.js';

const FORBIDDEN = [
  'beer',
  'tej',
  'wine',
  'whiskey',
  'vodka',
  'gin',
  'arake',
  'areke',
  'liquor',
  'cocktail',
  'alcohol',
  'pork',
  'bacon',
  'ham',
];

describe('starter pack data', () => {
  it('has about 150 items, every item in exactly one pack and one group', () => {
    const fromPacks = PACKS.flatMap((p) => p.groups.flatMap((g) => g.items.map((i) => i.key)));
    expect(fromPacks.length).toBeGreaterThanOrEqual(140);
    expect(new Set(fromPacks).size).toBe(fromPacks.length); // a key never appears twice
    expect(CATALOG_ITEMS.map((i) => i.key)).toEqual(fromPacks);
    expect(new Set(PACKS.map((p) => p.key)).size).toBe(PACKS.length);
    for (const pack of PACKS) {
      expect(new Set(pack.groups.map((g) => g.key)).size, pack.key).toBe(pack.groups.length);
    }
  });

  it('every pack and group has items; categories are valid', () => {
    for (const pack of PACKS) {
      expect(pack.groups.length, pack.key).toBeGreaterThan(0);
      expect(pack.nameAm.trim(), pack.key).not.toBe('');
      for (const group of pack.groups) {
        expect(group.items.length, `${pack.key}/${group.key}`).toBeGreaterThan(0);
        expect(['food', 'drinks', 'combos']).toContain(group.category);
        expect(group.nameAm.trim(), group.key).not.toBe('');
      }
    }
  });

  it('every item: slug key, integer price, English and Amharic name, 1..60 chars, unique names', () => {
    for (const item of CATALOG_ITEMS) {
      expect(item.key, item.key).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(Number.isInteger(item.suggestedPriceEtb), item.key).toBe(true);
      expect(item.suggestedPriceEtb, item.key).toBeGreaterThanOrEqual(1);
      expect(item.name.length, item.key).toBeGreaterThanOrEqual(1);
      expect(item.name.length, item.key).toBeLessThanOrEqual(60);
      expect(item.nameAm.trim().length, item.key).toBeGreaterThan(0);
    }
    // Same name in two packs would make "add both packs" silently skip one of them.
    const names = CATALOG_ITEMS.map((i) => normalizeName(i.name));
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
  });

  it('contains NO alcohol and NO pork', () => {
    const texts = PACKS.flatMap((pack) => [
      pack.key,
      pack.name,
      ...pack.groups.flatMap((g) => [g.key, g.name, ...g.items.flatMap((i) => [i.key, i.name])]),
    ]);
    const offending = texts.filter((text) =>
      FORBIDDEN.some((word) => text.toLowerCase().includes(word))
    );
    expect(offending).toEqual([]);
  });

  it('percent price changes round to the nearest 5 ETB, at least 1', () => {
    expect(applyPercent(450, 10)).toBe(495);
    expect(applyPercent(60, 7)).toBe(65); // 64.2 -> 65
    expect(applyPercent(60, 3)).toBe(60); // 61.8 -> 60
    expect(applyPercent(60, -50)).toBe(30);
    expect(applyPercent(1, -50)).toBe(1);
    expect(applyPercent(100, 200)).toBe(300);
  });
});
