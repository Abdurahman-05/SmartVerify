import type { BankAccount } from './bankAccounts';
import { mockDelay } from './mock';

export interface VerifyPaymentInput {
  account: BankAccount;
  amount: number;
  qrData: string;
}

export type FailureReason = 'nameMismatch' | 'amountMismatch' | 'duplicate';

export type VerificationResult =
  | {
      status: 'verified';
      amount: number;
      accountName: string;
      reference: string;
      verifiedAt: string;
    }
  | {
      status: 'failed';
      reason: 'nameMismatch';
      registeredName: string;
      payerName: string;
      reference: string;
    }
  | {
      status: 'failed';
      reason: 'amountMismatch';
      expectedAmount: number;
      paidAmount: number;
      reference: string;
    }
  | {
      status: 'failed';
      reason: 'duplicate';
      reference: string;
      firstVerifiedAt: string;
    };

const mockReference = () => `FT${Date.now().toString().slice(-10)}`;

/**
 * Mock: the last whole digit of the amount picks the outcome so every screen can be tested.
 * 1 = name mismatch, 2 = amount mismatch, 3 = duplicate, anything else = verified.
 */
export async function verifyPayment({ account, amount }: VerifyPaymentInput): Promise<VerificationResult> {
  await mockDelay(2200);
  const reference = mockReference();

  switch (Math.floor(amount) % 10) {
    case 1:
      return {
        status: 'failed',
        reason: 'nameMismatch',
        registeredName: account.holderName,
        payerName: 'Kebede Tadesse',
        reference,
      };
    case 2:
      return {
        status: 'failed',
        reason: 'amountMismatch',
        expectedAmount: amount,
        paidAmount: Math.max(amount - 100, 0),
        reference,
      };
    case 3:
      return {
        status: 'failed',
        reason: 'duplicate',
        reference,
        firstVerifiedAt: new Date(Date.now() - 3600_000).toISOString(),
      };
    default:
      return {
        status: 'verified',
        amount,
        accountName: account.holderName,
        reference,
        verifiedAt: new Date().toISOString(),
      };
  }
}
