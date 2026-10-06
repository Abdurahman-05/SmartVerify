import { create } from 'zustand';

import type { BankAccount } from '@/lib/mock/bankAccounts';
import type { VerificationResult } from '@/lib/mock/verify';

interface VerifyFlowState {
  account: BankAccount | null;
  amount: number;
  qrData: string | null;
  result: VerificationResult | null;
  setAccount: (account: BankAccount) => void;
  setAmount: (amount: number) => void;
  setQrData: (qrData: string) => void;
  setResult: (result: VerificationResult) => void;
  /** Clears the payment but keeps the chosen account for the next customer. */
  finish: () => void;
}

export const useVerifyFlow = create<VerifyFlowState>((set) => ({
  account: null,
  amount: 0,
  qrData: null,
  result: null,
  setAccount: (account) => set({ account }),
  setAmount: (amount) => set({ amount }),
  setQrData: (qrData) => set({ qrData, result: null }),
  setResult: (result) => set({ result }),
  finish: () => set({ amount: 0, qrData: null, result: null }),
}));
