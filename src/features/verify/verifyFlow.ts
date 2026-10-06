import { create } from 'zustand';

import type { BankAccount } from '@/lib/mock/bankAccounts';
import type { VerificationResult } from '@/lib/mock/verify';

interface VerifyFlowState {
  account: BankAccount | null;
  amountInput: string;
  qrData: string | null;
  result: VerificationResult | null;
  setAccount: (account: BankAccount) => void;
  setAmountInput: (amountInput: string) => void;
  setQrData: (qrData: string) => void;
  setResult: (result: VerificationResult) => void;
  /** Clears the payment but keeps the chosen account for the next customer. */
  finish: () => void;
}

export const useVerifyFlow = create<VerifyFlowState>((set) => ({
  account: null,
  amountInput: '',
  qrData: null,
  result: null,
  setAccount: (account) => set({ account }),
  setAmountInput: (amountInput) => set({ amountInput }),
  setQrData: (qrData) => set({ qrData, result: null }),
  setResult: (result) => set({ result }),
  finish: () => set({ amountInput: '', qrData: null, result: null }),
}));
