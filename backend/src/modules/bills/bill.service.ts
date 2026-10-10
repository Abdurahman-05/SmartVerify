import type { PrismaClient, Prisma, BillStatus, BillType } from '../../generated/prisma/client.js';
import type { AuthContext } from '../../plugins/auth.js';
import { AppError } from '../../shared/errors/app-error.js';

import { billDetailInclude, billListInclude, toBillDetail, toBillListItem } from './bill-view.js';

export interface ListBillsQuery {
  status?: BillStatus;
  type?: BillType;
  mine: boolean;
  cursor?: string;
  limit: number;
}

/** Bills the signed-in member may see: always their business; waiters only their own bills. */
export const visibleBills = (auth: AuthContext): Prisma.BillWhereInput => ({
  businessId: auth.businessId,
  ...(auth.role === 'waiter' && { waiterId: auth.memberId }),
});

export async function loadBillDetail(prisma: PrismaClient, where: Prisma.BillWhereInput) {
  const row = await prisma.bill.findFirst({ where, include: billDetailInclude });
  if (!row) throw new AppError('NOT_FOUND');
  return toBillDetail(row);
}

export function createBillService(prisma: PrismaClient) {
  return {
    /** Newest first, cursor = id of the last item of the previous page. */
    async list(auth: AuthContext, query: ListBillsQuery) {
      const rows = await prisma.bill.findMany({
        where: {
          ...visibleBills(auth),
          ...(query.mine && { waiterId: auth.memberId }),
          ...(query.status && { status: query.status }),
          ...(query.type && { type: query.type }),
        },
        include: billListInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
        ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
      });
      const page = rows.slice(0, query.limit);
      return {
        items: page.map(toBillListItem),
        nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null,
      };
    },

    get: (auth: AuthContext, id: string) => loadBillDetail(prisma, { id, ...visibleBills(auth) }),

    /** Owner, manager, or a member allowed to change delivery fees. Only open delivery bills. */
    async changeDeliveryFee(auth: AuthContext, id: string, amount: number) {
      const allowed = auth.role === 'owner' || auth.role === 'manager' || auth.canChangeDeliveryFee;
      if (!allowed) throw new AppError('FORBIDDEN');

      const bill = await prisma.bill.findFirst({ where: { id, ...visibleBills(auth) } });
      if (!bill) throw new AppError('NOT_FOUND');
      if (bill.status !== 'open') throw new AppError('BILL_CLOSED');
      if (bill.type !== 'delivery') {
        throw new AppError('VALIDATION_ERROR', { reason: 'notDelivery' });
      }

      // Food and packing never change on an open bill, so the new total is exact.
      // The status condition makes this a no-op if the bill was paid meanwhile.
      const { count } = await prisma.bill.updateMany({
        where: { id: bill.id, status: 'open' },
        data: {
          deliveryFeeEtb: amount,
          deliveryFeeChangedById: auth.memberId,
          totalEtb: bill.foodTotalEtb + bill.packingFeeEtb + amount,
        },
      });
      if (count === 0) throw new AppError('BILL_CLOSED');
      return loadBillDetail(prisma, { id: bill.id, businessId: auth.businessId });
    },
  };
}
