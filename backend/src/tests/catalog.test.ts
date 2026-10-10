import { describe, expect, it } from 'vitest';

import { CATALOG, catalogGroups } from '../modules/menu/catalog.js';
import { applyPercent } from '../modules/menu/menu.service.js';

const ALCOHOL = [
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
];

describe('sample catalog data', () => {
  it('has about 60 items with unique keys, integer prices and Amharic names', () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(55);
    expect(CATALOG.length).toBeLessThanOrEqual(65);
    expect(new Set(CATALOG.map((i) => i.key)).size).toBe(CATALOG.length);
    for (const item of CATALOG) {
      expect(item.key, item.key).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(Number.isInteger(item.suggestedPriceEtb), item.key).toBe(true);
      expect(item.suggestedPriceEtb, item.key).toBeGreaterThanOrEqual(1);
      expect(item.nameAm.trim().length, item.key).toBeGreaterThan(0);
      expect(item.name.trim().length, item.key).toBeGreaterThan(0);
      expect(catalogGroups[item.category] as readonly string[], item.key).toContain(item.group);
    }
  });

  it('every group has items', () => {
    for (const groups of Object.values(catalogGroups)) {
      for (const group of groups) {
        expect(
          CATALOG.some((i) => i.group === group),
          group
        ).toBe(true);
      }
    }
  });

  it('contains NO alcoholic drinks', () => {
    const offending = CATALOG.filter((item) =>
      [item.name, item.key, item.group].some((text) =>
        ALCOHOL.some((word) => text.toLowerCase().includes(word))
      )
    ).map((i) => i.key);
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
