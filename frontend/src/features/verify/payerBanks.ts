/** One thing to find on the customer's receipt (or in its QR). */
export interface ReceiptField {
  key: 'reference' | 'senderAccount' | 'transactionNumber';
  /** What the user types when reading did not find it. */
  input: 'text' | 'digits';
  length?: number;
  /** Sample value drawn on the receipt picture. */
  sample: string;
  /** Fixes what the user types, e.g. upper case for references. */
  normalize: (value: string) => string;
  valid: (value: string) => boolean;
  /** Not on the receipt: the user types it (e.g. CBE's receiver account digits). */
  typed?: boolean;
}

/** A bank the customer paid from. Screens render from `fields`, never per bank. */
export interface PayerBank {
  code: string;
  name: string;
  shortName: string;
  /** Shown first, as big buttons. */
  mostUsed?: boolean;
  /** Its receipts carry a QR with the receipt link (CBE). Telebirr's do not. */
  hasQr?: boolean;
  fields: ReceiptField[];
  /** Reads the fields from the receipt QR, or null when the QR is not this bank's receipt. */
  parseQr: (data: string) => Partial<Record<ReceiptField['key'], string>> | null;
}

const upper = (v: string) => v.replace(/\s/g, '').toUpperCase();
const digits = (v: string) => v.replace(/\D/g, '');

const reference: ReceiptField = {
  key: 'reference',
  input: 'text',
  sample: 'FT26283K4Z9P',
  normalize: upper,
  valid: (v) => /^[A-Z0-9]{8,20}$/.test(v),
};

// Placeholder banks: the real supported banks and their fields replace these with the backend.
const referenceOnly = (code: string, name: string, shortName: string): PayerBank => ({
  code,
  name,
  shortName,
  fields: [reference],
  parseQr: () => null,
});

export const payerBanks: PayerBank[] = [
  {
    code: 'CBE',
    name: 'Commercial Bank of Ethiopia',
    shortName: 'CBE',
    mostUsed: true,
    hasQr: true,
    fields: [
      reference,
      {
        // CBE's receipt link is the Transaction ID + the SENDER's account last 8 digits
        // (checked on a real receipt); receipts show only 4 of them, so the user types them.
        key: 'senderAccount',
        input: 'digits',
        length: 8,
        sample: '29213267',
        typed: true,
        normalize: digits,
        valid: (v) => /^\d{8}$/.test(v),
      },
    ],
    // CBE receipt link: ...?id=FT26283K4Z9P29213267 (reference + sender account last 8).
    parseQr: (data) => {
      const m = /[?&]id=([A-Z0-9]{12})(\d{8})/i.exec(data);
      return m ? { reference: m[1].toUpperCase(), senderAccount: m[2] } : null;
    },
  },
  {
    code: 'TEL',
    name: 'Telebirr',
    shortName: 'Telebirr',
    mostUsed: true,
    fields: [
      {
        key: 'transactionNumber',
        input: 'text',
        sample: 'DJK3A9X2PQ',
        normalize: upper,
        valid: (v) => /^[A-Z0-9]{10}$/.test(v),
      },
    ],
    // Telebirr receipt link: .../receipt/DJK3A9X2PQ
    parseQr: (data) => {
      const m = /receipt\/([A-Z0-9]{10})\b/i.exec(data);
      return m ? { transactionNumber: m[1].toUpperCase() } : null;
    },
  },
  referenceOnly('DAS', 'Dashen Bank', 'Dashen'),
  referenceOnly('BOA', 'Bank of Abyssinia', 'Abyssinia'),
  referenceOnly('AWA', 'Awash Bank', 'Awash'),
  referenceOnly('ZEM', 'Zemen Bank', 'Zemen'),
  referenceOnly('MPS', 'M-Pesa', 'M-Pesa'),
  referenceOnly('CBB', 'CBE Birr', 'CBE Birr'),
  referenceOnly('WEG', 'Wegagen Bank', 'Wegagen'),
];

export const findPayerBank = (code: string | null) => payerBanks.find((b) => b.code === code);

/** What can be found on the receipt picture (typed fields are asked for afterwards). */
export const onReceipt = (bank: PayerBank) => bank.fields.filter((f) => !f.typed);
