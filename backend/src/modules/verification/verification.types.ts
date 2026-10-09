/**
 * Verification boundary.
 *
 * Future pipeline (each step is its own module, none built yet):
 *   QR decode / OCR of the payment screen / pasted SMS  ->  normalised PaymentEvidence
 *   -> VerificationProvider (an authorised bank or aggregator source)  ->  ProviderLookup
 *   -> VerificationService decides verified / mismatch / duplicate / pending / unable_to_verify.
 *
 * A payment is only "verified" when a provider confirms it from an authoritative source.
 */

export type EvidenceType = 'qr' | 'ocr' | 'sms';

/** What the app captured, before any provider-specific parsing. Raw images are never stored. */
export interface PaymentEvidence {
  type: EvidenceType;
  /** QR text, OCR-extracted text, or the pasted SMS. */
  raw: string;
}

/** A connected receiving account the payment may have arrived in. */
export interface CandidateAccount {
  id: string;
  bankCode: string;
  accountNumber: string;
  holderName: string | null;
}

/** A transfer confirmed by an authoritative source. */
export interface ConfirmedTransfer {
  bankCode: string;
  reference: string;
  receiverAccountNumber: string;
  payerName: string;
  amount: number;
  occurredAt?: Date;
}

export type ProviderLookup =
  | { outcome: 'found'; transfer: ConfirmedTransfer }
  | { outcome: 'not_found' }
  | { outcome: 'pending' }
  | { outcome: 'unavailable' };

export interface VerificationProvider {
  readonly id: string;
  /** Whether this provider understands this evidence (e.g. it recognises the bank in the QR). */
  canHandle(evidence: PaymentEvidence): boolean;
  /** Look the payment up against all of the business's connected accounts. */
  lookup(evidence: PaymentEvidence, accounts: CandidateAccount[]): Promise<ProviderLookup>;
}

export type UnableReason = 'NO_PROVIDER' | 'NO_ACCOUNTS' | 'PROVIDER_UNAVAILABLE';

export type VerificationOutcome =
  | {
      status: 'verified';
      transactionId: string;
      amount: number;
      accountId: string;
      accountName: string | null;
      reference: string;
      verifiedAt: string;
    }
  | {
      status: 'failed';
      reason: 'amountMismatch';
      transactionId: string;
      expectedAmount: number;
      paidAmount: number;
      reference: string;
    }
  | {
      status: 'failed';
      reason: 'duplicate';
      transactionId: string;
      reference: string;
      firstVerifiedAt: string;
    }
  | { status: 'failed'; reason: 'wrongAccount' | 'notFound' }
  | { status: 'pending' }
  | { status: 'unable_to_verify'; reason: UnableReason };
