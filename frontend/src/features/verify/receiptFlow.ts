import { create } from 'zustand';

import type { ReceiptField } from './payerBanks';

export type ReceiptValues = Partial<Record<ReceiptField['key'], string>>;

/** What a reference read from a picture fills in, for the bank it came from. */
export function foundFromReference(bankCode: string, reference: string | null): ReceiptValues {
  if (!reference) return {};
  if (bankCode === 'TEL') return { transactionNumber: reference };
  // BOA's SMS link gives the FT reference and the sender's last 5 at once.
  const boa = bankCode === 'BOA' ? /^(FT[A-Z0-9]{10})(\d{5})$/.exec(reference) : null;
  return boa ? { reference: boa[1], senderLast5: boa[2] } : { reference };
}

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
  /** Normal Verify: the bank is not chosen, it is found from the QR or the picture. */
  startAuto: () => void;
  setBank: (bankCode: string) => void;
  setFound: (found: ReceiptValues) => void;
}

export const useReceiptFlow = create<ReceiptFlowState>((set) => ({
  mode: 'normal',
  bankCode: null,
  found: {},
  setMode: (mode) => set({ mode }),
  startAuto: () => set({ mode: 'normal', bankCode: null, found: {} }),
  setBank: (bankCode) => set({ bankCode, found: {} }),
  setFound: (found) => set({ found }),
}));
