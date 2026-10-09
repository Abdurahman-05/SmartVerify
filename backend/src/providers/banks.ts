export interface Bank {
  code: string;
  name: string;
  shortName: string;
}

/**
 * Banks the app can connect. Same list as the app's mock (src/lib/mock/bankAccounts.ts).
 * Placeholder until the real supported list and per-bank account-number rules are confirmed.
 */
export const SUPPORTED_BANKS: Bank[] = [
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

export const findBank = (code: string) => SUPPORTED_BANKS.find((b) => b.code === code);
