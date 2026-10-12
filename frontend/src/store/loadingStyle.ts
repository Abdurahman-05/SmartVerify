import { create } from 'zustand';

/** How a screen looks while its data loads. A trial setting: one style will be kept. */
export type LoadingStyle = 'brand' | 'light' | 'skeleton';

export const loadingStyles: LoadingStyle[] = ['brand', 'light', 'skeleton'];

interface LoadingStyleState {
  loadingStyle: LoadingStyle;
  setLoadingStyle: (style: LoadingStyle) => void;
}

// In memory only, like the color theme: resets when the app restarts.
export const useLoadingStyle = create<LoadingStyleState>((set) => ({
  loadingStyle: 'brand',
  setLoadingStyle: (loadingStyle) => set({ loadingStyle }),
}));
