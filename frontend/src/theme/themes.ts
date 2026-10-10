import { vars } from 'nativewind';

export interface BrandColors {
  primary: string;
  primaryText: string;
  primaryTint: string;
  primaryTile: string;
}

export const THEME_IDS = ['forest', 'ocean', 'royal', 'teal', 'slate', 'rose', 'berry'] as const;
export type ThemeId = (typeof THEME_IDS)[number];
export const DEFAULT_THEME: ThemeId = 'forest';

// Only the brand colors change. Status pills, tipBg and amber stay the same in every theme.
export const themes: Record<ThemeId, BrandColors> = {
  forest: { primary: '#0D4A36', primaryText: '#0D6B47', primaryTint: '#E6F2EC', primaryTile: '#DDEFE6' },
  ocean: { primary: '#0B3D6B', primaryText: '#0B5CA8', primaryTint: '#E5F0FA', primaryTile: '#D6E7F7' },
  royal: { primary: '#3F2A7A', primaryText: '#5B3FB0', primaryTint: '#EEEAF8', primaryTile: '#E0D9F2' },
  teal: { primary: '#0B4F55', primaryText: '#0E7480', primaryTint: '#E3F2F3', primaryTile: '#D2EAEC' },
  slate: { primary: '#26323F', primaryText: '#3D5A80', primaryTint: '#E8EDF2', primaryTile: '#DAE3EC' },
  rose: { primary: '#9D174D', primaryText: '#BE185D', primaryTint: '#FDF0F5', primaryTile: '#FADCE8' },
  berry: { primary: '#6B1F5E', primaryText: '#8E2B7C', primaryTint: '#F7ECF5', primaryTile: '#EFD8EB' },
};

export const isThemeId = (id: unknown): id is ThemeId =>
  typeof id === 'string' && (THEME_IDS as readonly string[]).includes(id);

/** Unknown or removed theme ids fall back to forest. */
export const resolveThemeId = (id: unknown): ThemeId => (isThemeId(id) ? id : DEFAULT_THEME);

/** "#0D4A36" -> "13 74 54", the format Tailwind's rgb(var() / alpha) colors expect. */
const rgb = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');

export const themeVars = (id: ThemeId) => {
  const t = themes[id];
  return vars({
    '--color-primary': rgb(t.primary),
    '--color-primary-text': rgb(t.primaryText),
    '--color-primary-tint': rgb(t.primaryTint),
    '--color-primary-tile': rgb(t.primaryTile),
  });
};
