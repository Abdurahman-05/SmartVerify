import { createContext, useContext } from 'react';

import { setColorMode } from './tokens';

export type ColorMode = 'light' | 'dark';
const KEY = 'gebtual.admin.colorMode';

/** The saved choice, else the computer's setting. */
export function initialColorMode(): ColorMode {
  try {
    const saved = globalThis.localStorage?.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Storage blocked: follow the computer.
  }
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Switches the page (CSS variables) and the colors code reads, and remembers it. */
export function applyColorMode(mode: ColorMode, remember = false) {
  setColorMode(mode);
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = mode;
  if (!remember) return;
  try {
    globalThis.localStorage?.setItem(KEY, mode);
  } catch {
    // Not saved: it follows the computer next time.
  }
}

export const ColorModeContext = createContext<{ mode: ColorMode; toggle: () => void }>({
  mode: 'light',
  toggle: () => undefined,
});

export const useColorMode = () => useContext(ColorModeContext);
