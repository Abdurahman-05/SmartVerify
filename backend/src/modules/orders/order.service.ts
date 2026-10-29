import { Prisma, type OrderNote, type PrismaClient } from '../../generated/prisma/client.js';
import type { AuthContext } from '../../plugins/auth.js';
import { notify } from '../../services/notifications.js';
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

type OrderLines = { menuItemId: string; quantity: number }[];

/** Prices come from the menu in the database, never from the client. */
async function priceLines(tx: Prisma.TransactionClient, businessId: string, items: OrderLines) {
  const ids = [...new Set(items.map((i) => i.menuItemId))];
  const menu = await tx.menuItem.findMany({
    where: { businessId, id: { in: ids }, active: true },
  });
  const byId = new Map(menu.map((m) => [m.id, m]));
  const unavailable = ids.filter((id) => !byId.has(id));
  if (unavailable.length) {
    throw new AppError('ITEM_UNAVAILABLE', { menuItemIds: unavailable });
  }
  const lines = items.flatMap((i) => {
    const item = byId.get(i.menuItemId);
    return item
      ? [{ menuItemId: item.id, name: item.name, priceEtb: item.priceEtb, quantity: i.quantity }]
      : [];
  });
  const foodTotalEtb = lines.reduce((sum, l) => sum + l.priceEtb * l.quantity, 0);
  return { lines, foodTotalEtb };
}

/**
 * The bill's food total from its orders that are not cancelled (fees stay). With no order left
 * the bill is cancelled (frees the table). When every remaining order is ready it is served.
 */
async function settleBillTotals(tx: Prisma.TransactionClient, billId: string) {
  const bill = await tx.bill.findUniqueOrThrow({
    where: { id: billId },
    select: { packingFeeEtb: true, deliveryFeeEtb: true },
  });
  const active = await tx.order.findMany({
    where: { billId, cancelledAt: null },
    select: { foodTotalEtb: true, kitchenOrder: { select: { status: true } } },
  });
  const foodTotalEtb = active.reduce((sum, o) => sum + o.foodTotalEtb, 0);
  const allReady = active.every((o) => o.kitchenOrder?.status === 'ready');
  await tx.bill.update({
    where: { id: billId },
    data: {
      foodTotalEtb,
      totalEtb: foodTotalEtb + bill.packingFeeEtb + bill.deliveryFeeEtb,
      ...(active.length === 0
        ? { status: 'cancelled' as const }
        : { servedStatus: allReady ? ('served' as const) : ('kitchen' as const) }),
    },
  });
}

/** What the kitchen notification needs about an order. */
const orderNotice = (o: {
  number: number;
  bill: { type: string; table: { number: number } | null };
}) => ({ orderNo: o.number, type: o.bill.type, table: o.bill.table?.number ?? null });

export function createOrderService(prisma: PrismaClient) {
  /**
   * An order that may still change: on an open bill with no bank money yet, the kitchen has not
   * started, and (for a waiter) it is their own. Anything else: ORDER_LOCKED / NOT_FOUND.
   */
  async function changeable(tx: Prisma.TransactionClient, auth: AuthContext, orderId: string) {
    const order = await tx.order.findFirst({
      where: { id: orderId, businessId: auth.businessId },
      select: {
        id: true,
        billId: true,
        number: true,
        waiterId: true,
        cancelledAt: true,
        kitchenOrder: { select: { id: true, status: true } },
        bill: {
          select: {
            status: true,
            bankReceivedEtb: true,
            type: true,
            table: { select: { number: true } },
          },
        },
      },
    });
    if (!order) throw new AppError('NOT_FOUND');
    if (auth.role === 'waiter' && order.waiterId !== auth.memberId) {
      throw new AppError('FORBIDDEN');
    }
    const reason =
      order.cancelledAt !== null
        ? 'cancelled'
        : order.bill.status !== 'open'
          ? 'billClosed'
          : order.bill.bankReceivedEtb > 0
            ? 'paymentStarted'
            : order.kitchenOrder && order.kitchenOrder.status !== 'new'
              ? 'cooking'
              : null;
    if (reason) throw new AppError('ORDER_LOCKED', { reason });
    return order;
  }
  const existingBillId = async (businessId: string, idempotencyKey: string) =>
    (
      await prisma.order.findUnique({
        where: { businessId_idempotencyKey: { businessId, idempotencyKey } },
        select: { billId: true },
      })
    )?.billId;

  return {
    /** More items for an open bill: a new order and kitchen ticket on the same bill. */
    async addToBill(
      auth: AuthContext,
      billId: string,
      input: { notes: OrderNote[]; items: OrderLines },
      idempotencyKey: string
    ) {
      const { businessId, memberId } = auth;
      if (!(await existingBillId(businessId, idempotencyKey))) {
        try {
          await prisma.$transaction(async (tx) => {
            const bill = await tx.bill.findFirst({
              where: {
                id: billId,
                businessId,
                ...(auth.role === 'waiter' && { waiterId: memberId }),
              },
              select: { status: true },
            });
            if (!bill) throw new AppError('NOT_FOUND');
            if (bill.status !== 'open') throw new AppError('BILL_CLOSED');
            const { lines, foodTotalEtb } = await priceLines(tx, businessId, input.items);
            const { nextOrderNumber } = await tx.business.update({
              where: { id: businessId },
              data: { nextOrderNumber: { increment: 1 } },
              select: { nextOrderNumber: true },
            });
            await tx.order.create({
              data: {
                businessId,
                billId,
                number: nextOrderNumber - 1,
                notes: input.notes,
                waiterId: memberId,
                foodTotalEtb,
                idempotencyKey,
                items: { create: lines },
                kitchenOrder: { create: { businessId } },
              },
            });
            await settleBillTotals(tx, billId);
          });
        } catch (error) {
          // The same request arrived twice at once: the other one saved it.
          if (!uniqueViolation(error)?.includes('idempotencyKey')) throw error;
        }
        const order = await prisma.order.findUnique({
          where: { businessId_idempotencyKey: { businessId, idempotencyKey } },
          select: {
            number: true,
            _count: { select: { items: true } },
            bill: { select: { type: true, table: { select: { number: true } } } },
          },
        });
        if (order) {
          await notify(prisma, undefined, {
            businessId,
            to: { roles: ['chef'] },
            type: 'order_added',
            data: { ...orderNotice(order), items: order._count.items },
          });
        }
      }
      return loadBillDetail(prisma, { id: billId, businessId });
    },

    /** New items for an order the kitchen has not started (replaces its list). */
    async changeItems(auth: AuthContext, orderId: string, items: OrderLines) {
      const { businessId } = auth;
      const order = await prisma.$transaction(async (tx) => {
        const target = await changeable(tx, auth, orderId);
        const { lines, foodTotalEtb } = await priceLines(tx, businessId, items);
        await tx.orderItem.deleteMany({ where: { orderId } });
        await tx.order.update({
          where: { id: orderId },
          data: { foodTotalEtb, editedAt: new Date(), items: { create: lines } },
        });
        await settleBillTotals(tx, target.billId);
        return target;
      });
      await notify(prisma, undefined, {
        businessId,
        to: { roles: ['chef'] },
        type: 'order_changed',
        data: { ...orderNotice(order), items: items.length },
      });
      return loadBillDetail(prisma, { id: order.billId, businessId });
    },

    /** Cancel an order the kitchen has not started; its ticket leaves the kitchen. */
    async cancel(auth: AuthContext, orderId: string, reason: string) {
      const { businessId } = auth;
      const order = await prisma.$transaction(async (tx) => {
        const target = await changeable(tx, auth, orderId);
        if (target.kitchenOrder) {
          await tx.kitchenOrder.delete({ where: { id: target.kitchenOrder.id } });
        }
        await tx.order.update({
          where: { id: orderId },
          data: { cancelledAt: new Date(), cancelReason: reason, cancelledById: auth.memberId },
        });
        await settleBillTotals(tx, target.billId);
        return target;
      });
      await notify(prisma, undefined, {
        businessId,
        to: { roles: ['chef'] },
        type: 'order_cancelled',
        data: { ...orderNotice(order), reason },
      });
      return loadBillDetail(prisma, { id: order.billId, businessId });
    },

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
            const { lines, foodTotalEtb } = await priceLines(tx, businessId, input.items);

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
      // The kitchen hears about it at once.
      const order = await prisma.order.findFirst({
        where: { billId },
        select: {
          number: true,
          _count: { select: { items: true } },
          bill: { select: { type: true, table: { select: { number: true } } } },
        },
      });
      if (order) {
        await notify(prisma, undefined, {
          businessId,
          to: { roles: ['chef'] },
          type: 'new_order',
          data: {
            orderNo: order.number,
            type: order.bill.type,
            table: order.bill.table?.number ?? null,
            items: order._count.items,
          },
        });
      }
      return loadBillDetail(prisma, { id: billId, businessId });
    },
  };
}
