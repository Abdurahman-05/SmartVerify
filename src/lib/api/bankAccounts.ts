import { mockDelay } from './mock';

export interface BankAccount {
  id: string;
  bankCode: string;
  bankName: string;
  shortName: string;
  last4: string;
  holderName: string;
}

export const mockAccounts: BankAccount[] = [
  {
    id: 'acc-cbe',
    bankCode: 'CBE',
    bankName: 'Commercial Bank of Ethiopia',
    shortName: 'CBE',
    last4: '4582',
    holderName: 'Abebe Coffee',
  },
  {
    id: 'acc-telebirr',
    bankCode: 'TEL',
    bankName: 'Telebirr',
    shortName: 'Telebirr',
    last4: '7788',
    holderName: 'Abebe Coffee',
  },
  {
    id: 'acc-awash',
    bankCode: 'AWA',
    bankName: 'Awash Bank',
    shortName: 'Awash',
    last4: '1290',
    holderName: 'Abebe Coffee',
  },
];

export async function getBankAccounts(): Promise<BankAccount[]> {
  await mockDelay(500);
  return mockAccounts;
}
