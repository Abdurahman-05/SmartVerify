import { create } from 'zustand';

/** How pages look while loading. A trial setting: one style will be kept. */
export type LoadingStyle = 'brand' | 'light';

export const loadingStyles: LoadingStyle[] = ['brand', 'light'];

interface LoadingStyleState {
  loadingStyle: LoadingStyle;
  setLoadingStyle: (style: LoadingStyle) => void;
}

// In memory only, like the color theme: resets when the app restarts.
export const useLoadingStyle = create<LoadingStyleState>((set) => ({
  loadingStyle: 'light',
  setLoadingStyle: (loadingStyle) => set({ loadingStyle }),
}));
