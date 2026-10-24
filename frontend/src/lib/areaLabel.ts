import type { TFunction } from 'i18next';

/** The fixed areas the offline mock still uses; they have translated names. */
const fixedAreas = new Set(['main', 'upstairs', 'outside']);

/**
 * The name to show for a table's category: the Amharic name when the app is in Amharic and one
 * exists, otherwise the category's own name. The mock's fixed areas stay translated.
 */
export function areaLabel(
  t: TFunction,
  language: string,
  area: string | undefined,
  areaAm?: string | null
): string {
  if (language === 'am' && areaAm) return areaAm;
  if (area && fixedAreas.has(area)) return t(`orders.area.${area}`);
  return area ?? '';
}
