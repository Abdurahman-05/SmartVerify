/** One thing to find on the customer's receipt (or in its QR). */
export interface ReceiptField {
  key: 'reference' | 'senderAccount' | 'senderLast5' | 'transactionNumber' | 'receiptLink';
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
  /**
   * The receipt link needs only the last digits of an account: the user types the whole
   * number (people do not know it from the middle) and the link takes these last digits.
   */
  last?: number;
}

/** The value as the receipt link needs it (the last digits of a typed full account). */
export const linkValue = (field: ReceiptField | undefined, value: string) =>
  field?.last ? value.slice(-field.last) : value;

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
        // (checked on a real receipt); receipts show only 4 of them, so the user types the
        // full account number and the link takes its last 8.
        key: 'senderAccount',
        input: 'digits',
        length: 16,
        last: 8,
        sample: '1000429213267',
        typed: true,
        normalize: digits,
        valid: (v) => /^\d{8,16}$/.test(v),
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
    hasQr: true,
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
  {
    code: 'DAS',
    name: 'Dashen Bank',
    shortName: 'Dashen',
    hasQr: true,
    fields: [
      {
        // Dashen's "FT Ref" (not the longer "Transaction Ref" starting with WDTI).
        key: 'reference',
        input: 'text',
        sample: 'C65WDTI262870002',
        normalize: upper,
        valid: (v) => /^[A-Z0-9]{10,24}$/.test(v),
      },
    ],
    parseQr: () => null,
  },
  {
    code: 'BOA',
    name: 'Bank of Abyssinia',
    shortName: 'Abyssinia',
    fields: [
      reference,
      {
        // BOA's receipt id is the FT reference + the SENDER's account last 5 digits: the user
        // types the full account number and the link takes its last 5.
        key: 'senderLast5',
        input: 'digits',
        length: 16,
        last: 5,
        sample: '91110431',
        typed: true,
        normalize: digits,
        valid: (v) => /^\d{5,16}$/.test(v),
      },
    ],
    parseQr: () => null,
  },
  {
    code: 'MPE',
    name: 'M-PESA',
    shortName: 'M-PESA',
    // No QR code: the number comes from the receipt picture (app screen or SMS), or is typed.
    fields: [
      {
        // "Transaction ID" in the app, "Transaction number" in the SMS (10 letters / digits).
        key: 'transactionNumber',
        input: 'text',
        sample: 'UJK0TV2TAO',
        normalize: upper,
        valid: (v) => /^[A-Z0-9]{10}$/.test(v),
      },
    ],
    parseQr: () => null,
  },
  {
    code: 'EBR',
    name: 'eBirr',
    shortName: 'eBirr',
    // No QR code: the receipt link in the SMS is read from a picture of it, or typed.
    fields: [
      {
        // "receipt.ebirr.com/<institution>/<token>": the token is case-sensitive, so no upper case.
        key: 'receiptLink',
        input: 'text',
        sample: 'kaafimf/7Ca4gqKiADLtuj5VPOWuaQ',
        normalize: (v) => v.replace(/\s/g, '').replace(/^https?:\/\/receipt\.ebirr\.com\//i, ''),
        valid: (v) => /^[a-z0-9]{2,30}\/[A-Za-z0-9_-]{16,64}$/.test(v),
      },
    ],
    parseQr: () => null,
  },
  referenceOnly('AWA', 'Awash Bank', 'Awash'),
  referenceOnly('ZEM', 'Zemen Bank', 'Zemen'),
  referenceOnly('CBB', 'CBE Birr', 'CBE Birr'),
  referenceOnly('WEG', 'Wegagen Bank', 'Wegagen'),
];

export const findPayerBank = (code: string | null) => payerBanks.find((b) => b.code === code);

/** What can be found on the receipt picture (typed fields are asked for afterwards). */
export const onReceipt = (bank: PayerBank) => bank.fields.filter((f) => !f.typed);
