import { create } from 'zustand';

import i18n from '@/i18n';
import { isNetworkError } from '@/lib/errors';

interface ToastState {
  message: string | null;
  /** Bumps on every show, so the same text twice restarts the timer. */
  id: number;
  show: (message: string) => void;
  hide: () => void;
}

export const useToast = create<ToastState>((set) => ({
  message: null,
  id: 0,
  show: (message) => set((s) => ({ message, id: s.id + 1 })),
  hide: () => set({ message: null }),
}));

export const showToast = (message: string) => useToast.getState().show(message);

/** A write failed for lack of internet: say so; the screen and what was typed stay as they are. */
export function toastIfNetworkError(error: unknown): boolean {
  if (!isNetworkError(error)) return false;
  showToast(i18n.t('errors.noInternetTryAgain'));
  return true;
}
