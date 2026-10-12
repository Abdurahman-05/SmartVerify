import {
  BankAccountError,
  type AddBankAccountInput,
  type BankAccount,
} from '@/lib/mock/bankAccounts';

import { api, ApiError } from './client';

/** GET /bank-accounts — connected receiving accounts (only the last 4 digits). */
export const getBankAccounts = () => api<BankAccount[]>('/bank-accounts');

/**
 * POST /bank-accounts. The server's ACCOUNT_DUPLICATE / ACCOUNT_LIMIT become the same
 * BankAccountError the screens already handle.
 */
export async function addBankAccount(input: AddBankAccountInput): Promise<BankAccount> {
  try {
    return await api<BankAccount>('/bank-accounts', { method: 'POST', body: input });
  } catch (error) {
    if (error instanceof ApiError && error.code === 'ACCOUNT_DUPLICATE') {
      throw new BankAccountError('duplicate');
    }
    if (error instanceof ApiError && error.code === 'ACCOUNT_LIMIT') {
      throw new BankAccountError('limit');
    }
    throw error;
  }
}

/** DELETE /bank-accounts/:id — removed from the list; past records keep it. */
export async function removeBankAccount(id: string): Promise<void> {
  await api(`/bank-accounts/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
