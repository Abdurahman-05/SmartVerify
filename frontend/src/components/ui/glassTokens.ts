import { useBrandColors } from '@/store/theme';
import { shade } from '@/ui/glass/glassColors';

/** "#EA580C", 0.3 -> "rgba(234,88,12,0.3)". */
export function alpha(hex: string, a: number): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${a})`;
}

/** Current theme colours for the glass components; primary2 is a lighter primary. */
export function useGlass() {
  const brand = useBrandColors();
  return {
    primary: brand.primary,
    primary2: shade(brand.primary, 0.16),
    primaryText: brand.primaryText,
    tint: brand.tint,
    tile: brand.tile,
  };
}
