import { mockDelay } from './mock';

export interface Bank {
  code: string;
  name: string;
  shortName: string;
}

export interface BankAccount {
  id: string;
  bankCode: string;
  bankName: string;
  shortName: string;
  last4: string;
  holderName: string;
}

export interface AddBankAccountInput {
  bankCode: string;
  accountNumber: string;
  holderName?: string;
}

export const MAX_BANK_ACCOUNTS = 6;

export const banks: Bank[] = [
  { code: 'CBE', name: 'Commercial Bank of Ethiopia', shortName: 'CBE' },
  { code: 'TEL', name: 'Telebirr', shortName: 'Telebirr' },
  { code: 'AWA', name: 'Awash Bank', shortName: 'Awash' },
  { code: 'DAS', name: 'Dashen Bank', shortName: 'Dashen' },
  { code: 'BOA', name: 'Bank of Abyssinia', shortName: 'BOA' },
  { code: 'ABY', name: 'Abay Bank', shortName: 'Abay' },
  { code: 'WEG', name: 'Wegagen Bank', shortName: 'Wegagen' },
  { code: 'HIB', name: 'Hibret Bank', shortName: 'Hibret' },
  { code: 'NIB', name: 'Nib International Bank', shortName: 'Nib' },
  { code: 'COO', name: 'Cooperative Bank of Oromia', shortName: 'Coop' },
  { code: 'ZEM', name: 'Zemen Bank', shortName: 'Zemen' },
];

const fromBank = (code: string, id: string, accountNumber: string, holderName: string) => {
  const bank = banks.find((b) => b.code === code) ?? banks[0];
  return {
    id,
    bankCode: bank.code,
    bankName: bank.name,
    shortName: bank.shortName,
    last4: accountNumber.slice(-4),
    holderName,
    accountNumber,
    removed: false,
  };
};

type StoredAccount = ReturnType<typeof fromBank>;

const stored: StoredAccount[] = [
  fromBank('CBE', 'acc-cbe', '1000293884582', 'Abebe Coffee'),
  fromBank('TEL', 'acc-telebirr', '0911227788', 'Abebe Coffee'),
  fromBank('AWA', 'acc-awash', '01320456781290', 'Abebe Coffee'),
];

const toPublic = ({ accountNumber: _n, removed: _r, ...account }: StoredAccount): BankAccount => account;

/** Connected accounts only. */
export const activeAccounts = () => stored.filter((a) => !a.removed).map(toPublic);

/** Includes removed accounts so old transactions still show their bank. */
export const findAccount = (id: string) => {
  const found = stored.find((a) => a.id === id);
  return found ? toPublic(found) : null;
};

export async function getBankAccounts(): Promise<BankAccount[]> {
  await mockDelay(500);
  return activeAccounts();
}

export class BankAccountError extends Error {
  constructor(public code: 'duplicate' | 'limit') {
    super(code);
  }
}

export async function addBankAccount(input: AddBankAccountInput): Promise<BankAccount> {
  await mockDelay(1500);
  const active = stored.filter((a) => !a.removed);
  if (active.length >= MAX_BANK_ACCOUNTS) throw new BankAccountError('limit');
  if (active.some((a) => a.bankCode === input.bankCode && a.accountNumber === input.accountNumber)) {
    throw new BankAccountError('duplicate');
  }
  // Mock: a real backend would look the name up from the bank when it's left empty.
  const account = fromBank(
    input.bankCode,
    `acc-${Date.now()}`,
    input.accountNumber,
    input.holderName?.trim() || 'Abebe Coffee'
  );
  stored.push(account);
  return toPublic(account);
}

export async function removeBankAccount(id: string): Promise<void> {
  await mockDelay(600);
  const account = stored.find((a) => a.id === id);
  if (account) account.removed = true;
}
