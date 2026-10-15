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
  status: string;
  /**
   * cbe = CBE to CBE (receiver name and account last 4 are real). other_bank = CBE to another
   * bank: the receiver is CBE's inter-bank account, the real destination is in the reason.
   * wallet = Telebirr to Telebirr (receiver name + phone masked to first and last 4 digits).
   * wallet_to_bank = Telebirr to a bank account (full account number + holder name).
   */
  transfer: 'cbe' | 'other_bank' | 'wallet' | 'wallet_to_bank';
  /** "Reason / Type of service": the sender's note (CBE to CBE) or the destination account. */
  reason: string;
  /** Destination account at another bank / from a wallet ('' when the receiver is used). */
  destinationAccount: string;
}

export interface ReceiptParser {
  /** null when a required field is missing (the receipt cannot be trusted). */
  parse(content: string): ParsedReceipt | null;
}
