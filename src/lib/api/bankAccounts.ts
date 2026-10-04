import { mockDelay } from './mock';

export interface BankAccount {
  id: string;
  bankCode: string;
  bankName: string;
  last4: string;
  holderName: string;
}

const accounts: BankAccount[] = [
  {
    id: 'acc-cbe',
    bankCode: 'CBE',
    bankName: 'Commercial Bank of Ethiopia',
    last4: '4582',
    holderName: 'Abebe Coffee',
  },
  { id: 'acc-telebirr', bankCode: 'TB', bankName: 'Telebirr', last4: '7788', holderName: 'Abebe Coffee' },
  { id: 'acc-awash', bankCode: 'AWB', bankName: 'Awash Bank', last4: '1290', holderName: 'Abebe Coffee' },
];

export async function getBankAccounts(): Promise<BankAccount[]> {
  await mockDelay(500);
  return accounts;
}
