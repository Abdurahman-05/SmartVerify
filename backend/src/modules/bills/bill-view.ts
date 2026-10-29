import { z } from 'zod';

import type { KitchenStatus, Prisma } from '../../generated/prisma/client.js';

// ─── Response shapes ────────────────────────────────────────────────────────

const billTypeSchema = z.enum(['dine', 'takeaway', 'delivery']);
const kitchenStatusSchema = z.enum(['new', 'cooking', 'ready']);
const orderNoteSchema = z.enum(['noOnion', 'lessSpicy', 'rush', 'takeaway']);

export const billListItemSchema = z.object({
  id: z.string(),
  label: z.string().describe('"Table 12", "Takeaway #1044", "Delivery #1043"'),
  type: billTypeSchema,
  tableId: z.string().nullable(),
  tableNumber: z.number().int().nullable(),
  tableCategory: z.string().nullable().describe('Name of the table’s category, e.g. "VIP"'),
  tableCategoryAm: z.string().nullable(),
  guests: z.number().int().nullable(),
  customerName: z.string().nullable(),
  deliveryAreaName: z.string().nullable(),
  orderNo: z.number().int().describe('Number of the first order on the bill'),
  waiterId: z.string(),
  status: z.enum(['open', 'paid', 'cancelled']),
  servedStatus: z.enum(['kitchen', 'served']),
  totalEtb: z.number().int(),
  createdAt: z.string(),
  waiterName: z.string(),
  kitchenStatus: kitchenStatusSchema.describe("Least advanced status of the bill's kitchen orders"),
});

export const billDetailSchema = billListItemSchema.extend({
  customerPhone: z.string().nullable(),
  deliveryAreaId: z.string().nullable(),
  address: z.string().nullable(),
  foodTotalEtb: z.number().int(),
  packingFeeEtb: z.number().int(),
  deliveryFeeEtb: z.number().int(),
  usualDeliveryFeeEtb: z.number().int().nullable(),
  bankReceivedEtb: z.number().int(),
  deliveryFeeChangedBy: z
    .string()
    .nullable()
    .describe('Name of who changed the delivery fee, when it differs from the usual fee'),
  paidAt: z.string().nullable(),
  orders: z.array(
    z.object({
      id: z.string(),
      number: z.number().int(),
      createdAt: z.string(),
      notes: z.array(orderNoteSchema),
      items: z.array(
        z.object({
          menuItemId: z.string().nullable(),
          name: z.string(),
          priceEtb: z.number().int(),
          quantity: z.number().int(),
        })
      ),
      kitchenStatus: kitchenStatusSchema,
      edited: z.boolean().describe('Items were changed before cooking'),
      cancelled: z.boolean().describe('Cancelled before cooking: not counted in the total'),
      cancelReason: z.string().nullable(),
    })
  ),
});

export type BillListItem = z.infer<typeof billListItemSchema>;
export type BillDetail = z.infer<typeof billDetailSchema>;

// ─── Queries ────────────────────────────────────────────────────────────────

const memberName = { select: { user: { select: { name: true } } } } as const;

export const billListInclude = {
  table: { select: { number: true, category: { select: { name: true, nameAm: true } } } },
  deliveryArea: { select: { name: true } },
  waiter: memberName,
  orders: {
    orderBy: { number: 'asc' },
    select: { number: true, kitchenOrder: { select: { status: true } } },
  },
} satisfies Prisma.BillInclude;

export const billDetailInclude = {
  table: { select: { number: true, category: { select: { name: true, nameAm: true } } } },
  deliveryArea: { select: { name: true } },
  waiter: memberName,
  deliveryFeeChangedBy: memberName,
  orders: {
    orderBy: { number: 'asc' },
    include: { items: { orderBy: { id: 'asc' } }, kitchenOrder: { select: { status: true } } },
  },
} satisfies Prisma.BillInclude;

type ListRow = Prisma.BillGetPayload<{ include: typeof billListInclude }>;
type DetailRow = Prisma.BillGetPayload<{ include: typeof billDetailInclude }>;

// ─── Mapping ────────────────────────────────────────────────────────────────

const kitchenRank: Record<KitchenStatus, number> = { new: 0, cooking: 1, ready: 2 };

/** The least advanced kitchen status, so a bill is "ready" only when every order is ready. */
function leastAdvanced(statuses: (KitchenStatus | undefined)[]): KitchenStatus {
  return statuses.reduce<KitchenStatus>(
    (least, s) => (s && kitchenRank[s] < kitchenRank[least] ? s : least),
    statuses.length ? 'ready' : 'new'
  );
}

/** Computed, not stored: "Table 12" / "Takeaway #1044" / "Delivery #1043" (first order number). */
function billLabel(
  row: { type: ListRow['type']; table: { number: number } | null },
  firstOrderNumber?: number
) {
  if (row.type === 'dine') return `Table ${row.table?.number ?? ''}`.trim();
  const name = row.type === 'takeaway' ? 'Takeaway' : 'Delivery';
  return `${name} #${firstOrderNumber ?? ''}`;
}

export function toBillListItem(row: ListRow | DetailRow): BillListItem {
  return {
    id: row.id,
    label: billLabel(row, row.orders[0]?.number),
    type: row.type,
    tableId: row.tableId,
    tableNumber: row.table?.number ?? null,
    tableCategory: row.table?.category.name ?? null,
    tableCategoryAm: row.table?.category.nameAm ?? null,
    guests: row.guests,
    customerName: row.customerName,
    deliveryAreaName: row.deliveryArea?.name ?? null,
    orderNo: row.orders[0]?.number ?? 0,
    waiterId: row.waiterId,
    status: row.status,
    servedStatus: row.servedStatus,
    totalEtb: row.totalEtb,
    createdAt: row.createdAt.toISOString(),
    waiterName: row.waiter.user.name,
    kitchenStatus: leastAdvanced(row.orders.map((o) => o.kitchenOrder?.status)),
  };
}

export function toBillDetail(row: DetailRow): BillDetail {
  const feeChanged =
    row.usualDeliveryFeeEtb !== null && row.deliveryFeeEtb !== row.usualDeliveryFeeEtb;
  return {
    ...toBillListItem(row),
    customerPhone: row.customerPhone,
    deliveryAreaId: row.deliveryAreaId,
    address: row.address,
    foodTotalEtb: row.foodTotalEtb,
    packingFeeEtb: row.packingFeeEtb,
    deliveryFeeEtb: row.deliveryFeeEtb,
    usualDeliveryFeeEtb: row.usualDeliveryFeeEtb,
    bankReceivedEtb: row.bankReceivedEtb,
    deliveryFeeChangedBy: feeChanged ? (row.deliveryFeeChangedBy?.user.name ?? null) : null,
    paidAt: row.paidAt?.toISOString() ?? null,
    orders: row.orders.map((o) => ({
      id: o.id,
      number: o.number,
      createdAt: o.createdAt.toISOString(),
      notes: o.notes,
      items: o.items.map((i) => ({
        menuItemId: i.menuItemId,
        name: i.name,
        priceEtb: i.priceEtb,
        quantity: i.quantity,
      })),
      kitchenStatus: o.kitchenOrder?.status ?? 'new',
      edited: o.editedAt !== null,
      cancelled: o.cancelledAt !== null,
      cancelReason: o.cancelReason,
    })),
  };
}
