import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';

import { saveFailedCheck } from './verification.service.js';
import type { VerifyResponse } from './verification.schemas.js';

/** Checks (verified and failed) older than this are deleted every day. */
export const KEEP_CHECKS_MONTHS = 4;

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

/**
 * After any bank check (normal Verify or a restaurant bill), the same for every bank:
 * a verified receipt is saved once — the same receipt again, anywhere, is answered as a
 * DUPLICATE not_matching (unless it is a retry for the same bill); anything that does not verify
 * is saved as a failed check so it shows in history.
 */
export async function recordCheck(
  prisma: PrismaClient,
  input: {
    businessId: string;
    memberId: string;
    billId?: string;
    bankCode: string;
    expectedAmountEtb: number;
    result: VerifyResponse;
  }
): Promise<VerifyResponse> {
  const { result } = input;
  if (result.status !== 'verified') {
    await saveFailedCheck(prisma, { ...input, checkedById: input.memberId, result });
    return result;
  }

  try {
    await prisma.transaction.create({
      data: {
        businessId: input.businessId,
        memberId: input.memberId,
        billId: input.billId ?? null,
        bankCode: input.bankCode,
        reference: result.reference,
        payerName: result.payerName,
        expectedAmount: input.expectedAmountEtb,
        receivedAmount: result.amountEtb,
        status: 'verified',
        verifiedAt: new Date(),
      },
    });
    return result;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }

  // This receipt was already verified once (a reference counts only once, across businesses).
  const first = await prisma.transaction.findFirst({
    where: { bankCode: input.bankCode, reference: result.reference, status: 'verified' },
    select: { billId: true, businessId: true, createdAt: true },
  });
  // Checking the same bill again (e.g. the answer was lost) is not a second use.
  if (
    first &&
    input.billId &&
    first.billId === input.billId &&
    first.businessId === input.businessId
  ) {
    return result;
  }
  const duplicate: VerifyResponse = {
    status: 'not_matching',
    reasons: ['DUPLICATE'],
    reference: result.reference,
    amountEtb: result.amountEtb,
    ...(first && { firstCheckedAt: first.createdAt.toISOString() }),
  };
  await saveFailedCheck(prisma, {
    ...input,
    checkedById: input.memberId,
    result: duplicate,
  });
  return duplicate;
}

/** Verified receipts since `from`, newest first. Waiters see only their own checks. */
export async function listVerified(
  prisma: PrismaClient,
  auth: { businessId: string; memberId: string; role: string },
  from: Date
) {
  const rows = await prisma.transaction.findMany({
    where: {
      businessId: auth.businessId,
      status: 'verified',
      createdAt: { gte: from },
      ...(auth.role === 'waiter' && { memberId: auth.memberId }),
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
    include: { member: { select: { user: { select: { name: true } } } } },
  });
  return rows.map((row) => ({
    id: row.id,
    billId: row.billId,
    bankCode: row.bankCode,
    reference: row.reference ?? '',
    payerName: row.payerName,
    amountEtb: row.receivedAmount,
    expectedAmountEtb: row.expectedAmount,
    checkedBy: row.member.user.name,
    createdAt: row.createdAt.toISOString(),
  }));
}

/** Deletes verified and failed checks older than KEEP_CHECKS_MONTHS. Returns how many went. */
export async function deleteOldChecks(prisma: PrismaClient, now = new Date()) {
  const before = new Date(now);
  before.setMonth(before.getMonth() - KEEP_CHECKS_MONTHS);
  const old = { createdAt: { lt: before } };
  const [, transactions, failed] = await prisma.$transaction([
    // Anything pointing at an old transaction as its original is unlinked first.
    prisma.transaction.updateMany({
      where: { duplicateOf: old },
      data: { duplicateOfId: null },
    }),
    prisma.transaction.deleteMany({ where: old }),
    prisma.receiptCheck.deleteMany({ where: old }),
  ]);
  return { transactions: transactions.count, failedChecks: failed.count };
}
