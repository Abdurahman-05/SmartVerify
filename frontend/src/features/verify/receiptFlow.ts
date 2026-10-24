import { create } from 'zustand';

import type { ReceiptField } from './payerBanks';

export type ReceiptValues = Partial<Record<ReceiptField['key'], string>>;

/** Normal Verify (an amount only) or a restaurant bill: the bank steps are the same for both. */
export type ReceiptMode = 'normal' | 'restaurant';

/** Where the bank steps go once the receipt is known. */
export const checkingRoute = (mode: ReceiptMode) =>
  mode === 'restaurant' ? '/verify-restaurant/checking' : '/checking';

/** Where the bank steps go back to when there is nothing to check. */
export const startRoute = (mode: ReceiptMode) => (mode === 'restaurant' ? '/bills' : '/verify');

interface ReceiptFlowState {
  mode: ReceiptMode;
  /** The bank the customer paid from (not our receiving account). */
  bankCode: string | null;
  /** What the QR or the receipt reading found. */
  found: ReceiptValues;
  setMode: (mode: ReceiptMode) => void;
  setBank: (bankCode: string) => void;
  setFound: (found: ReceiptValues) => void;
}

export const useReceiptFlow = create<ReceiptFlowState>((set) => ({
  mode: 'normal',
  bankCode: null,
  found: {},
  setMode: (mode) => set({ mode }),
  setBank: (bankCode) => set({ bankCode, found: {} }),
  setFound: (found) => set({ found }),
}));
