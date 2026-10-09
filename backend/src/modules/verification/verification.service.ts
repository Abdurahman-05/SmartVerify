import type { PrismaClient, VerificationStatus } from '../../generated/prisma/client.js';
import type { AuthContext } from '../../plugins/auth.js';
import { AppError } from '../../shared/errors/app-error.js';
import { isUniqueViolation } from '../auth/auth.service.js';

import type {
  CandidateAccount,
  ConfirmedTransfer,
  PaymentEvidence,
  VerificationOutcome,
  VerificationProvider,
} from './verification.types.js';

export interface VerifyInput {
  expectedAmount: number;
  accountHintId?: string;
  evidence: PaymentEvidence;
  idempotencyKey?: string;
}

export function createVerificationService(prisma: PrismaClient, providers: VerificationProvider[]) {
  async function recordAttempt(
    auth: AuthContext,
    input: VerifyInput,
    status: VerificationStatus,
    reason: string | null,
    providerId: string | null,
    transactionId: string | null = null
  ) {
    await prisma.verificationAttempt.create({
      data: {
        businessId: auth.businessId,
        memberId: auth.memberId,
        inputType: input.evidence.type,
        expectedAmount: input.expectedAmount,
        accountHintId: input.accountHintId ?? null,
        status,
        reason,
        providerId,
        transactionId,
        idempotencyKey: input.idempotencyKey ?? null,
      },
    });
  }

  /** Saves the transaction and its attempt together. Returns null if the reference was verified concurrently. */
  async function saveTransfer(
    auth: AuthContext,
    input: VerifyInput,
    provider: VerificationProvider,
    account: CandidateAccount,
    transfer: ConfirmedTransfer,
    status: 'verified' | 'mismatch' | 'duplicate',
    reason: string | null
  ) {
    try {
      return await prisma.$transaction(async (tx) => {
        const row = await tx.transaction.create({
          data: {
            businessId: auth.businessId,
            bankAccountId: account.id,
            bankCode: transfer.bankCode,
            reference: transfer.reference,
            payerName: transfer.payerName,
            expectedAmount: input.expectedAmount,
            receivedAmount: transfer.amount,
            status,
            occurredAt: transfer.occurredAt ?? null,
          },
        });
        await tx.verificationAttempt.create({
          data: {
            businessId: auth.businessId,
            memberId: auth.memberId,
            inputType: input.evidence.type,
            expectedAmount: input.expectedAmount,
            accountHintId: input.accountHintId ?? null,
            status,
            reason,
            providerId: provider.id,
            transactionId: row.id,
            idempotencyKey: input.idempotencyKey ?? null,
          },
        });
        return row;
      });
    } catch (error) {
      if (isUniqueViolation(error)) return null;
      throw error;
    }
  }

  async function findVerified(businessId: string, transfer: ConfirmedTransfer) {
    return prisma.transaction.findFirst({
      where: {
        businessId,
        bankCode: transfer.bankCode,
        reference: transfer.reference,
        status: 'verified',
      },
    });
  }

  return {
    async verify(auth: AuthContext, input: VerifyInput): Promise<VerificationOutcome> {
      if (input.idempotencyKey) {
        const seen = await prisma.verificationAttempt.findUnique({
          where: {
            businessId_idempotencyKey: {
              businessId: auth.businessId,
              idempotencyKey: input.idempotencyKey,
            },
          },
        });
        if (seen) throw new AppError('CONFLICT', { reason: 'IDEMPOTENCY_KEY_REUSED' });
      }

      const accounts = await prisma.bankAccount.findMany({
        where: { businessId: auth.businessId, removedAt: null },
        select: { id: true, bankCode: true, accountNumber: true, holderName: true },
      });
      if (accounts.length === 0) {
        await recordAttempt(auth, input, 'unable_to_verify', 'NO_ACCOUNTS', null);
        return { status: 'unable_to_verify', reason: 'NO_ACCOUNTS' };
      }

      const provider = providers.find((p) => p.canHandle(input.evidence));
      if (!provider) {
        await recordAttempt(auth, input, 'unable_to_verify', 'NO_PROVIDER', null);
        return { status: 'unable_to_verify', reason: 'NO_PROVIDER' };
      }

      const result = await provider.lookup(input.evidence, accounts);
      if (result.outcome === 'unavailable') {
        await recordAttempt(auth, input, 'unable_to_verify', 'PROVIDER_UNAVAILABLE', provider.id);
        return { status: 'unable_to_verify', reason: 'PROVIDER_UNAVAILABLE' };
      }
      if (result.outcome === 'pending') {
        await recordAttempt(auth, input, 'pending', null, provider.id);
        return { status: 'pending' };
      }
      if (result.outcome === 'not_found') {
        await recordAttempt(auth, input, 'mismatch', 'notFound', provider.id);
        return { status: 'failed', reason: 'notFound' };
      }

      const transfer = result.transfer;
      // The payment may have arrived in any connected account, not only the one the user picked.
      const account = accounts.find(
        (a) =>
          a.bankCode === transfer.bankCode && a.accountNumber === transfer.receiverAccountNumber
      );
      if (!account) {
        await recordAttempt(auth, input, 'mismatch', 'wrongAccount', provider.id);
        return { status: 'failed', reason: 'wrongAccount' };
      }

      const duplicateOf = async () => {
        const first = await findVerified(auth.businessId, transfer);
        const row = await saveTransfer(
          auth,
          input,
          provider,
          account,
          transfer,
          'duplicate',
          'duplicate'
        );
        return {
          status: 'failed' as const,
          reason: 'duplicate' as const,
          transactionId: row?.id ?? first?.id ?? '',
          reference: transfer.reference,
          firstVerifiedAt: (first?.createdAt ?? new Date()).toISOString(),
        };
      };

      if (await findVerified(auth.businessId, transfer)) return duplicateOf();

      if (transfer.amount !== input.expectedAmount) {
        const row = await saveTransfer(
          auth,
          input,
          provider,
          account,
          transfer,
          'mismatch',
          'amountMismatch'
        );
        return {
          status: 'failed',
          reason: 'amountMismatch',
          transactionId: row?.id ?? '',
          expectedAmount: input.expectedAmount,
          paidAmount: transfer.amount,
          reference: transfer.reference,
        };
      }

      const row = await saveTransfer(auth, input, provider, account, transfer, 'verified', null);
      if (!row) return duplicateOf(); // another device verified the same reference at the same moment
      return {
        status: 'verified',
        transactionId: row.id,
        amount: transfer.amount,
        accountId: account.id,
        accountName: account.holderName,
        reference: transfer.reference,
        verifiedAt: row.createdAt.toISOString(),
      };
    },
  };
}
