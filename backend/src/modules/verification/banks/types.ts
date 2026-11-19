/** What a bank receipt says, read from its text. */
export interface ParsedReceipt {
  payerName: string;
  /** As printed, usually masked (e.g. 1****1234). */
  payerAccount: string;
  receiverName: string;
  receiverAccount: string;
  /** Whole birr; cents are dropped so a short payment is never rounded up. */
  amountEtb: number;
  currency: string;
  date: Date;
  reference: string;
  /** A second ID of the same payment (CBE Birr: the CBE core FT reference), for duplicates. */
  altReference?: string;
  status: string;
  /**
   * cbe = CBE to CBE (receiver name and account last 4 are real). other_bank = CBE to another
   * bank: the receiver is CBE's inter-bank account, the real destination is in the reason.
   * wallet = Telebirr to Telebirr (receiver name + phone masked to first and last 4 digits).
   * telebirr_bank = Telebirr to a bank account: the receipt's receiver name is the BANK's name,
   * so only the account number (+ the bank, when known) is checked; destinationBank = our bank code.
   * wallet_to_bank = (M-PESA, BOA) wallet to a bank account (full account number + holder name).
   * ebirr_bank = eBirr to a bank account (account printed 231****31, no holder name).
   * ebirr_wallet = eBirr to a wallet (name and full phone from the payment reason).
   * awash = Awash sender's receipt: beneficiary account (full or masked) + name, and the
   * receiving bank as our bank code in destinationBank.
   * cbebirr = CBE Birr receipt PDF: credit account masked (first/last 4, may be absent) + name.
   */
  transfer:
    | 'awash'
    | 'cbebirr'
    | 'cbe'
    | 'other_bank'
    | 'wallet'
    | 'wallet_to_bank'
    | 'telebirr_bank'
    | 'masked_account'
    | 'ebirr_bank'
    | 'ebirr_wallet';
  /** "Reason / Type of service": the sender's note (CBE to CBE) or the destination account. */
  reason: string;
  /** Destination account at another bank / from a wallet ('' when the receiver is used). */
  destinationAccount: string;
  /**
   * masked_account (Dashen): the receiving bank's name as printed ("Dashen Bank Sc"); the
   * receiver account is masked to its first and last digits (2926******311).
   */
  destinationBank?: string;
}

export interface ReceiptParser {
  /** null when a required field is missing (the receipt cannot be trusted). */
  parse(content: string): ParsedReceipt | null;
}
