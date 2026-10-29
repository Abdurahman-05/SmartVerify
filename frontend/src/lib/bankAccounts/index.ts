import * as real from '@/lib/api/bankAccounts';
import * as mock from '@/lib/mock/bankAccounts';

export type {
  AddBankAccountInput,
  Bank,
  BankAccount,
  BankAccountChanges,
} from '@/lib/mock/bankAccounts';
// The supported banks (same list as the server's) and the add/limit error the screens use.
export { BankAccountError, banks, MAX_BANK_ACCOUNTS } from '@/lib/mock/bankAccounts';

/** EXPO_PUBLIC_USE_MOCK_BANK_ACCOUNTS=true uses the offline mock; default is the real backend. */
export const USE_MOCK_BANK_ACCOUNTS = process.env.EXPO_PUBLIC_USE_MOCK_BANK_ACCOUNTS === 'true';

export const getBankAccounts = USE_MOCK_BANK_ACCOUNTS ? mock.getBankAccounts : real.getBankAccounts;
export const addBankAccount = USE_MOCK_BANK_ACCOUNTS ? mock.addBankAccount : real.addBankAccount;
export const updateBankAccount = USE_MOCK_BANK_ACCOUNTS
  ? mock.updateBankAccount
  : real.updateBankAccount;
export const removeBankAccount = USE_MOCK_BANK_ACCOUNTS
  ? mock.removeBankAccount
  : real.removeBankAccount;

export const bankAccountsKey = ['bank-accounts'] as const;
