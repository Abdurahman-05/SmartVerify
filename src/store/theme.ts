import { create } from 'zustand';

import { resolveThemeId, themes, type BrandColors, type ThemeId } from '@/theme/themes';

interface ThemeState {
  themeId: ThemeId;
  setTheme: (id: string) => void;
}

// In memory only for now: the choice resets when the app restarts.
export const useTheme = create<ThemeState>((set) => ({
  themeId: 'forest',
  setTheme: (id) => set({ themeId: resolveThemeId(id) }),
}));

/** Brand hex colors for props that cannot use classes (icons, SVG). */
export const useBrandColors = (): BrandColors => themes[resolveThemeId(useTheme((s) => s.themeId))];
