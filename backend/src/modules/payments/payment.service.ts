import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import type { AuthContext } from '../../plugins/auth.js';
import { AppError } from '../../shared/errors/app-error.js';
import { visibleBills } from '../bills/bill.service.js';

export type PayInput =
  | { method: 'cash'; cashEtb: number; extraChoice: 'tip' | 'giveback' }
  | {
      method: 'bank' | 'cash+bank';
      /** Cash part (cash+bank only). */
      cashEtb?: number;
      /** Bank money of THIS scan, as reported by the bank check. */
      bankReceivedEtb: number;
      reference?: string;
    };

/** What the app shows after a payment step (same idea as the app's calcPayment). */
export interface PayResult {
  /** paid = exact; over = more arrived (the extra is the waiter's tip); short = bill stays open. */
  status: 'paid' | 'over' | 'short';
  billId: string;
  method: 'cash' | 'bank' | 'cash+bank';
  totalEtb: number;
  cashEtb: number;
  /** All bank money received for this bill so far. */
  bankReceivedEtb: number;
  expectedBankEtb: number;
  remainingEtb: number;
  tipEtb: number;
  changeEtb: number;
}

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

const methodOf = (m: 'bank' | 'cash_bank' | 'cash'): PayResult['method'] =>
  m === 'cash_bank' ? 'cash+bank' : m;

export function createPaymentService(prisma: PrismaClient, allowUnverifiedBank: boolean) {
  /** The result of an earlier request with the same Idempotency-Key, if there was one. */
  async function replay(auth: AuthContext, billId: string, key: string): Promise<PayResult | null> {
    const { businessId } = auth;
    const [payment, scan] = await Promise.all([
      prisma.payment.findUnique({
        where: { businessId_idempotencyKey: { businessId, idempotencyKey: key } },
      }),
      prisma.billPaymentScan.findUnique({
        where: { businessId_idempotencyKey: { businessId, idempotencyKey: key } },
      }),
    ]);
    if (!payment && !scan) return null;
    const bill = await prisma.bill.findFirst({
      where: { id: payment?.billId ?? scan?.billId ?? billId, businessId },
      include: { payment: true },
    });
    if (!bill) return null;
    const paid = bill.payment;
    if (paid) {
      return {
        status: paid.tipEtb > 0 && paid.method !== 'cash' ? 'over' : 'paid',
        billId: bill.id,
        method: methodOf(paid.method),
        totalEtb: bill.totalEtb,
        cashEtb: paid.cashEtb,
        bankReceivedEtb: paid.bankEtb,
        expectedBankEtb: paid.method === 'cash' ? 0 : bill.totalEtb - paid.cashEtb,
        remainingEtb: 0,
        tipEtb: paid.tipEtb,
        changeEtb: paid.changeEtb,
      };
    }
    const cash = scan?.cashEtb ?? 0;
    const expected = bill.totalEtb - cash;
    return {
      status: 'short',
      billId: bill.id,
      method: cash > 0 ? 'cash+bank' : 'bank',
      totalEtb: bill.totalEtb,
      cashEtb: cash,
      bankReceivedEtb: bill.bankReceivedEtb,
      expectedBankEtb: expected,
      remainingEtb: Math.max(expected - bill.bankReceivedEtb, 0),
      tipEtb: 0,
      changeEtb: 0,
    };
  }

  /** Marks the bill paid; another payment closing it first makes this fail (rolls back). */
  async function close(tx: Prisma.TransactionClient, billId: string) {
    const { count } = await tx.bill.updateMany({
      where: { id: billId, status: 'open' },
      data: { status: 'paid', paidAt: new Date() },
    });
    if (count === 0) throw new AppError('BILL_CLOSED');
  }

  return {
    /**
     * Cash only, or one bank scan (bank / cash+bank). The server re-does the money maths:
     * expectedBank = total - cash; the sum of all scans decides paid / over (tip) / short.
     */
    async pay(auth: AuthContext, billId: string, input: PayInput, key: string): Promise<PayResult> {
      const earlier = await replay(auth, billId, key);
      if (earlier) return earlier;
      if (input.method !== 'cash' && !allowUnverifiedBank) {
        throw new AppError('PAYMENT_NOT_CONFIGURED');
      }

      try {
        return await prisma.$transaction(async (tx) => {
          const bill = await tx.bill.findFirst({ where: { id: billId, ...visibleBills(auth) } });
          if (!bill) throw new AppError('NOT_FOUND');
          if (bill.status !== 'open') throw new AppError('BILL_CLOSED');
          const total = bill.totalEtb;

          if (input.method === 'cash') {
            if (bill.bankReceivedEtb > 0) {
              throw new AppError('VALIDATION_ERROR', { reason: 'bankAlreadyReceived' });
            }
            if (input.cashEtb < total) {
              throw new AppError('VALIDATION_ERROR', {
                reason: 'notEnoughCash',
                missingEtb: total - input.cashEtb,
              });
            }
            const extra = input.cashEtb - total;
            const tip = input.extraChoice === 'tip' ? extra : 0;
            const change = input.extraChoice === 'giveback' ? extra : 0;
            await close(tx, bill.id);
            const payment = await tx.payment.create({
              data: {
                businessId: bill.businessId,
                billId: bill.id,
                method: 'cash',
                cashEtb: input.cashEtb,
                tipEtb: tip,
                changeEtb: change,
                recordedById: auth.memberId,
                idempotencyKey: key,
              },
            });
            if (tip > 0) {
              await tx.tip.create({
                data: {
                  businessId: bill.businessId,
                  billId: bill.id,
                  paymentId: payment.id,
                  amountEtb: tip,
                  source: 'cash',
                  waiterId: bill.waiterId,
                },
              });
            }
            return {
              status: 'paid' as const,
              billId: bill.id,
              method: 'cash' as const,
              totalEtb: total,
              cashEtb: input.cashEtb,
              bankReceivedEtb: 0,
              expectedBankEtb: 0,
              remainingEtb: 0,
              tipEtb: tip,
              changeEtb: change,
            };
          }

          const cash = input.method === 'bank' ? 0 : (input.cashEtb ?? 0);
          if (input.method === 'cash+bank' && (cash < 1 || cash >= total)) {
            // All cash is "Cash only"; no cash is "Bank".
            throw new AppError('VALIDATION_ERROR', { reason: 'cashPart' });
          }
          await tx.billPaymentScan.create({
            data: {
              businessId: bill.businessId,
              billId: bill.id,
              memberId: auth.memberId,
              amountEtb: input.bankReceivedEtb,
              cashEtb: cash,
              reference: input.reference ?? null,
              idempotencyKey: key,
            },
          });
          // Atomic add: two scans at the same moment both count.
          const { bankReceivedEtb: received } = await tx.bill.update({
            where: { id: bill.id },
            data: { bankReceivedEtb: { increment: input.bankReceivedEtb } },
            select: { bankReceivedEtb: true },
          });
          const expected = total - cash;
          const base = {
            billId: bill.id,
            method: input.method,
            totalEtb: total,
            cashEtb: cash,
            bankReceivedEtb: received,
            expectedBankEtb: expected,
            changeEtb: 0,
          };
          if (received < expected) {
            return {
              ...base,
              status: 'short' as const,
              remainingEtb: expected - received,
              tipEtb: 0,
            };
          }

          const tip = received - expected;
          await close(tx, bill.id);
          const payment = await tx.payment.create({
            data: {
              businessId: bill.businessId,
              billId: bill.id,
              method: input.method === 'bank' ? 'bank' : 'cash_bank',
              cashEtb: cash,
              bankEtb: received,
              tipEtb: tip,
              recordedById: auth.memberId,
              idempotencyKey: key,
            },
          });
          if (tip > 0) {
            await tx.tip.create({
              data: {
                businessId: bill.businessId,
                billId: bill.id,
                paymentId: payment.id,
                amountEtb: tip,
                source: 'bank',
                waiterId: bill.waiterId,
              },
            });
          }
          return {
            ...base,
            status: tip > 0 ? ('over' as const) : ('paid' as const),
            remainingEtb: 0,
            tipEtb: tip,
          };
        });
      } catch (error) {
        // The same request arrived twice at once: the other one was saved.
        if (isUniqueViolation(error)) {
          const winner = await replay(auth, billId, key);
          if (winner) return winner;
        }
        throw error;
      }
    },
  };
}
