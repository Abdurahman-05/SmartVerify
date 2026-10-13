import { create } from 'zustand';

import type { ReceiptField } from './payerBanks';

export type ReceiptValues = Partial<Record<ReceiptField['key'], string>>;

interface ReceiptFlowState {
  /** The bank the customer paid from (not our receiving account). */
  bankCode: string | null;
  /** What the QR or the receipt reading found. */
  found: ReceiptValues;
  setBank: (bankCode: string) => void;
  setFound: (found: ReceiptValues) => void;
}

export const useReceiptFlow = create<ReceiptFlowState>((set) => ({
  bankCode: null,
  found: {},
  setBank: (bankCode) => set({ bankCode, found: {} }),
  setFound: (found) => set({ found }),
}));
