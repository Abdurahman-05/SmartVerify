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
}

export interface ReceiptParser {
  /** null when a required field is missing (the receipt cannot be trusted). */
  parse(content: string): ParsedReceipt | null;
}
