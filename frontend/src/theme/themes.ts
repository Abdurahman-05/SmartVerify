import { vars } from 'nativewind';

export interface BrandColors {
  primary: string;
  primaryText: string;
  /** Flat fill for hero cards, buttons, active tabs and icon tiles: 78 % primary + 22 % #2A1D18. */
  primaryDeep: string;
  primaryTint: string;
  primaryTile: string;
  /** Light glass: screen background tint. */
  tint: string;
  /** Light glass: icon tile background. */
  tile: string;
}

export const THEME_IDS = [
  'orange',
  'forest',
  'ocean',
  'royal',
  'teal',
  'slate',
  'rose',
  'berry',
] as const;
export type ThemeId = (typeof THEME_IDS)[number];
/** New installs start in orange (it can be changed on first start and in Profile). */
export const DEFAULT_THEME: ThemeId = 'orange';

// Only the brand colors change. Status pills, tipBg and amber stay the same in every theme.
export const themes: Record<ThemeId, BrandColors> = {
  orange: {
    primary: '#E8590C',
    primaryText: '#C2410C',
    primaryDeep: '#BE4C0F',
    primaryTint: '#FFF3EA',
    primaryTile: '#FFE2CC',
    tint: '#FFF3EA',
    tile: '#FFE2CC',
  },
  forest: {
    primary: '#0D4A36',
    primaryText: '#0D6B47',
    primaryDeep: '#13402F',
    primaryTint: '#E6F2EC',
    primaryTile: '#DDEFE6',
    tint: '#E6F2EC',
    tile: '#DDEFE6',
  },
  ocean: {
    primary: '#0B3D6B',
    primaryText: '#0B5CA8',
    primaryDeep: '#123659',
    primaryTint: '#E5F0FA',
    primaryTile: '#D6E7F7',
    tint: '#E5F0FA',
    tile: '#D6E7F7',
  },
  royal: {
    primary: '#3F2A7A',
    primaryText: '#5B3FB0',
    primaryDeep: '#3A2764',
    primaryTint: '#EEEAF8',
    primaryTile: '#E0D9F2',
    tint: '#EEEAF8',
    tile: '#E0D9F2',
  },
  teal: {
    primary: '#0B4F55',
    primaryText: '#0E7480',
    primaryDeep: '#124448',
    primaryTint: '#E3F2F3',
    primaryTile: '#D2EAEC',
    tint: '#E3F2F3',
    tile: '#D2EAEC',
  },
  slate: {
    primary: '#26323F',
    primaryText: '#3D5A80',
    primaryDeep: '#272D36',
    primaryTint: '#E8EDF2',
    primaryTile: '#DAE3EC',
    tint: '#E8EDF2',
    tile: '#DAE3EC',
  },
  rose: {
    primary: '#9D174D',
    primaryText: '#BE185D',
    primaryDeep: '#841841',
    primaryTint: '#FDF0F5',
    primaryTile: '#FADCE8',
    tint: '#FDF0F5',
    tile: '#FADCE8',
  },
  berry: {
    primary: '#6B1F5E',
    primaryText: '#8E2B7C',
    primaryDeep: '#5D1F4F',
    primaryTint: '#F7ECF5',
    primaryTile: '#EFD8EB',
    tint: '#F7ECF5',
    tile: '#EFD8EB',
  },
};

export const isThemeId = (id: unknown): id is ThemeId =>
  typeof id === 'string' && (THEME_IDS as readonly string[]).includes(id);

/** Unknown or removed theme ids fall back to the default (rose). */
export const resolveThemeId = (id: unknown): ThemeId => (isThemeId(id) ? id : DEFAULT_THEME);

/** "#0D4A36" -> "13 74 54", the format Tailwind's rgb(var() / alpha) colors expect. */
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');

export const themeVars = (id: ThemeId) => {
  const t = themes[id];
  return vars({
    '--color-primary': rgb(t.primary),
    '--color-primary-text': rgb(t.primaryText),
    '--color-primary-tint': rgb(t.primaryTint),
    '--color-primary-tile': rgb(t.primaryTile),
  });
};
