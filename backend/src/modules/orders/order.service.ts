import { Prisma, type OrderNote, type PrismaClient } from '../../generated/prisma/client.js';
import type { AuthContext } from '../../plugins/auth.js';
import { AppError } from '../../shared/errors/app-error.js';
import { loadBillDetail } from '../bills/bill.service.js';

export interface NewOrderInput {
  type: 'dine' | 'takeaway' | 'delivery';
  tableId?: string;
  guests?: number;
  customerName?: string;
  customerPhone?: string;
  deliveryAreaId?: string;
  address?: string;
  notes: OrderNote[];
  items: { menuItemId: string; quantity: number }[];
}

/** Unique-index violations, identified by the index / columns Postgres reports. */
function uniqueViolation(error: unknown): string | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002')
    return null;
  return JSON.stringify(error.meta ?? {});
}

export function createOrderService(prisma: PrismaClient) {
  const existingBillId = async (businessId: string, idempotencyKey: string) =>
    (
      await prisma.order.findUnique({
        where: { businessId_idempotencyKey: { businessId, idempotencyKey } },
        select: { billId: true },
      })
    )?.billId;

  return {
    /**
     * Sends a new order: creates the bill, the order with its items and the kitchen ticket in one
     * transaction. Prices and fees come from the database, never from the client.
     * Replaying the same Idempotency-Key returns the bill of the first request.
     */
    async place(auth: AuthContext, input: NewOrderInput, idempotencyKey: string) {
      const { businessId, memberId } = auth;
      const replay = await existingBillId(businessId, idempotencyKey);
      if (replay) return loadBillDetail(prisma, { id: replay, businessId });

      let billId: string;
      try {
        billId = await prisma.$transaction(
          async (tx) => {
            const ids = [...new Set(input.items.map((i) => i.menuItemId))];
            const menu = await tx.menuItem.findMany({
              where: { businessId, id: { in: ids }, active: true },
            });
            const byId = new Map(menu.map((m) => [m.id, m]));
            const unavailable = ids.filter((id) => !byId.has(id));
            if (unavailable.length) {
              throw new AppError('ITEM_UNAVAILABLE', { menuItemIds: unavailable });
            }
            const lines = input.items.flatMap((i) => {
              const item = byId.get(i.menuItemId);
              return item
                ? [
                    {
                      menuItemId: item.id,
                      name: item.name,
                      priceEtb: item.priceEtb,
                      quantity: i.quantity,
                    },
                  ]
                : [];
            });
            const foodTotalEtb = lines.reduce((sum, l) => sum + l.priceEtb * l.quantity, 0);

            const business = await tx.business.findUniqueOrThrow({
              where: { id: businessId },
              select: { packingFeeEtb: true },
            });

            let target: Prisma.BillUncheckedCreateInput;
            const base = { businessId, waiterId: memberId, foodTotalEtb };
            if (input.type === 'dine') {
              const table = await tx.restaurantTable.findFirst({
                where: { id: input.tableId, businessId, active: true },
                select: { id: true },
              });
              if (!table) throw new AppError('NOT_FOUND', { field: 'tableId' });
              target = {
                ...base,
                type: 'dine',
                tableId: table.id,
                guests: input.guests ?? null,
                totalEtb: foodTotalEtb,
              };
            } else if (input.type === 'takeaway') {
              const packing = business.packingFeeEtb;
              target = {
                ...base,
                type: 'takeaway',
                customerName: input.customerName ?? null,
                customerPhone: input.customerPhone ?? null,
                packingFeeEtb: packing,
                totalEtb: foodTotalEtb + packing,
              };
            } else {
              const area = await tx.deliveryArea.findFirst({
                where: { id: input.deliveryAreaId, businessId, active: true },
              });
              if (!area) throw new AppError('NOT_FOUND', { field: 'deliveryAreaId' });
              const packing = business.packingFeeEtb;
              target = {
                ...base,
                type: 'delivery',
                customerName: input.customerName ?? null,
                customerPhone: input.customerPhone ?? null,
                deliveryAreaId: area.id,
                address: input.address ?? null,
                packingFeeEtb: packing,
                deliveryFeeEtb: area.usualFeeEtb,
                usualDeliveryFeeEtb: area.usualFeeEtb,
                totalEtb: foodTotalEtb + packing + area.usualFeeEtb,
              };
            }

            // A second open dine-in bill on the same table violates a partial unique index.
            const bill = await tx.bill.create({ data: target, select: { id: true } });

            // Row-locked increment: parallel orders wait here, so numbers never repeat.
            // Done late so the lock on the business row is held as briefly as possible.
            const { nextOrderNumber } = await tx.business.update({
              where: { id: businessId },
              data: { nextOrderNumber: { increment: 1 } },
              select: { nextOrderNumber: true },
            });

            await tx.order.create({
              data: {
                businessId,
                billId: bill.id,
                number: nextOrderNumber - 1,
                notes: input.notes,
                waiterId: memberId,
                foodTotalEtb,
                idempotencyKey,
                items: { create: lines },
                kitchenOrder: { create: { businessId } },
              },
            });
            return bill.id;
          },
          // Parallel orders queue on the business row lock (each holds it for a few round trips).
          // Generous limits so a burst of orders on a slow link waits instead of failing.
          { maxWait: 30_000, timeout: 60_000 }
        );
      } catch (error) {
        const violation = uniqueViolation(error);
        if (violation?.includes('idempotencyKey')) {
          // The same request arrived twice at once: the other one won, return its bill.
          const winner = await existingBillId(businessId, idempotencyKey);
          if (winner) return loadBillDetail(prisma, { id: winner, businessId });
        }
        if (violation?.includes('Bill_one_open_per_table') || violation?.includes('tableId')) {
          throw new AppError('TABLE_BUSY');
        }
        throw error;
      }
      return loadBillDetail(prisma, { id: billId, businessId });
    },
  };
}
