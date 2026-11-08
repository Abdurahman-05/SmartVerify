import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import {
  DEFAULT_THEME,
  resolveThemeId,
  themes,
  type BrandColors,
  type ThemeId,
} from '@/theme/themes';

const KEY = 'gebtual.theme';

interface ThemeState {
  themeId: ThemeId;
  /** false until the saved choice is read (first frame). */
  loaded: boolean;
  /** The user picked a theme (first start asks once, like a new editor install). */
  chosen: boolean;
  setTheme: (id: string) => void;
  load: () => Promise<void>;
}

export const useTheme = create<ThemeState>((set) => ({
  themeId: DEFAULT_THEME,
  loaded: false,
  chosen: false,
  setTheme: (id) => {
    const themeId = resolveThemeId(id);
    set({ themeId, chosen: true });
    // A failed save only means the question comes back next start.
    AsyncStorage.setItem(KEY, themeId).catch(() => undefined);
  },
  load: async () => {
    try {
      const saved = await AsyncStorage.getItem(KEY);
      set(
        saved ? { themeId: resolveThemeId(saved), chosen: true, loaded: true } : { loaded: true }
      );
    } catch {
      set({ loaded: true });
    }
  },
}));

/** Brand hex colors for props that cannot use classes (icons, SVG). */
export const useBrandColors = (): BrandColors => themes[resolveThemeId(useTheme((s) => s.themeId))];
