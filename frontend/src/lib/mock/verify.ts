import type { BankAccount } from './bankAccounts';
import { mockDelay } from './mock';
import { recordTransaction, type TransactionStatus } from './transactions';

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
export async function verifyPayment(input: VerifyPaymentInput): Promise<VerificationResult> {
  await mockDelay(2200);
  const result = mockResult(input);
  recordTransaction({
    accountId: input.account.id,
    payerName: result.status === 'failed' && result.reason === 'nameMismatch' ? result.payerName : 'Customer',
    reference: result.reference,
    expectedAmount: input.amount,
    receivedAmount: result.status === 'failed' && result.reason === 'amountMismatch' ? result.paidAmount : input.amount,
    status: statusOf(result),
    createdAt: new Date().toISOString(),
  });
  return result;
}

function statusOf(result: VerificationResult): TransactionStatus {
  if (result.status === 'verified') return 'verified';
  return result.reason === 'duplicate' ? 'duplicate' : 'mismatch';
}

function mockResult({ account, amount }: VerifyPaymentInput): VerificationResult {
  const reference = mockReference();

  switch (amount % 10) {
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

/** Dev-only: make the mock bank report the exact, a larger, or a smaller amount. */
export type BankCheckSimulation = 'exact' | 'over' | 'short';

export const SIMULATED_OVER_ETB = 200;
export const SIMULATED_SHORT_ETB = 100;

export interface BankCheckInput {
  account: BankAccount;
  expected: number;
  qrData: string;
  simulate?: BankCheckSimulation;
}

/** Mock: asks the bank how much arrived for this QR. Defaults to the expected amount. */
export async function checkBankPayment({
  expected,
  simulate = 'exact',
}: BankCheckInput): Promise<{ received: number; reference: string }> {
  await mockDelay(2200);
  const received =
    simulate === 'over'
      ? expected + SIMULATED_OVER_ETB
      : simulate === 'short'
        ? Math.max(expected - SIMULATED_SHORT_ETB, 0)
        : expected;
  return { received, reference: mockReference() };
}
