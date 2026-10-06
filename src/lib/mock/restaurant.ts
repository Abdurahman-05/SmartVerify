import { useBills } from '@/features/bills/store';

import { createBill } from './bills';
import { DELIVERY_FEE_BY_AREA } from './fees';
import { mockDelay } from './mock';

export type MenuCategory = 'food' | 'drinks' | 'combos';

export interface MenuItem {
  id: string;
  name: string;
  priceEtb: number;
  category: MenuCategory;
}

export type TableArea = 'main' | 'upstairs' | 'outside';

export interface Table {
  id: string;
  number: number;
  area: TableArea;
  busy: boolean;
}

export interface DeliveryArea {
  id: string;
  name: string;
  usualFeeEtb: number;
}

export type OrderType = 'dineIn' | 'takeaway' | 'delivery';

export type OrderNote = 'noOnion' | 'lessSpicy' | 'rush' | 'takeaway';

export interface OrderLine {
  itemId: string;
  name: string;
  priceEtb: number;
  quantity: number;
}

export type OrderTarget =
  | { type: 'dineIn'; tableId: string; tableNumber: number; area: TableArea }
  | { type: 'takeaway'; customerName: string; customerPhone?: string }
  | {
      type: 'delivery';
      areaName: string;
      deliveryFeeEtb: number;
      usualFeeEtb: number;
      address: string;
      customerPhone: string;
    };

export interface NewOrderInput {
  target: OrderTarget;
  lines: OrderLine[];
  notes: OrderNote[];
  waiterId: string;
  waiterName: string;
}

export interface Order extends NewOrderInput {
  id: string;
  number: number;
  foodTotalEtb: number;
  createdAt: string;
}

const menu: MenuItem[] = [
  { id: 'm-firfir', name: 'Special Firfir', priceEtb: 190, category: 'food' },
  { id: 'm-dorowat', name: 'Doro Wat', priceEtb: 150, category: 'food' },
  { id: 'm-shiro', name: 'Shiro Tegabino', priceEtb: 110, category: 'food' },
  { id: 'm-tibs', name: 'Beef Tibs', priceEtb: 220, category: 'food' },
  { id: 'm-kitfo', name: 'Kitfo', priceEtb: 260, category: 'food' },
  { id: 'm-beyaynetu', name: 'Beyaynetu', priceEtb: 140, category: 'food' },
  { id: 'm-coffee', name: 'Buna (Coffee)', priceEtb: 40, category: 'drinks' },
  { id: 'm-tea', name: 'Shai (Tea)', priceEtb: 30, category: 'drinks' },
  { id: 'm-juice', name: 'Avocado Juice', priceEtb: 90, category: 'drinks' },
  { id: 'm-water', name: 'Water 1L', priceEtb: 35, category: 'drinks' },
  { id: 'm-soda', name: 'Soft drink', priceEtb: 45, category: 'drinks' },
  { id: 'm-ambo', name: 'Ambo Sparkling Water', priceEtb: 45, category: 'drinks' },
  { id: 'm-combo-family', name: 'Family Combo', priceEtb: 650, category: 'combos' },
  { id: 'm-combo-fasting', name: 'Fasting Combo', priceEtb: 320, category: 'combos' },
];

const tables: Omit<Table, 'busy'>[] = (
  [
    ['main', 16],
    ['upstairs', 8],
    ['outside', 6],
  ] as const
).flatMap(([area, count]) =>
  Array.from({ length: count }, (_, i) => {
    const id = `${area}-${i + 1}`;
    return { id, number: i + 1, area };
  })
);

export const deliveryAreas: DeliveryArea[] = [
  { id: 'bole', name: 'Bole', usualFeeEtb: DELIVERY_FEE_BY_AREA.bole },
  { id: 'kazanchis', name: 'Kazanchis', usualFeeEtb: DELIVERY_FEE_BY_AREA.kazanchis },
  { id: 'megenagna', name: 'Megenagna', usualFeeEtb: DELIVERY_FEE_BY_AREA.megenagna },
  { id: 'sarbet', name: 'Sarbet', usualFeeEtb: DELIVERY_FEE_BY_AREA.sarbet },
  { id: 'piassa', name: 'Piassa', usualFeeEtb: DELIVERY_FEE_BY_AREA.piassa },
  { id: 'cmc', name: 'CMC', usualFeeEtb: DELIVERY_FEE_BY_AREA.cmc },
];

const orders: Order[] = [];
let nextOrderNumber = 1043;

export async function getMenu(): Promise<MenuItem[]> {
  await mockDelay(400);
  return menu;
}

/** A table is busy while it has an open dine-in bill. */
export async function getTables(): Promise<Table[]> {
  await mockDelay(300);
  const open = useBills.getState().bills.filter((b) => b.type === 'dine' && b.status === 'open');
  return tables.map((t) => ({
    ...t,
    busy: open.some((b) => b.tableNo === t.number && (b.tableArea ?? 'main') === t.area),
  }));
}

export async function sendOrder(input: NewOrderInput): Promise<Order> {
  await mockDelay(1200);
  const order: Order = {
    ...input,
    id: `order-${Date.now()}`,
    number: nextOrderNumber++,
    foodTotalEtb: input.lines.reduce((sum, l) => sum + l.priceEtb * l.quantity, 0),
    createdAt: new Date().toISOString(),
  };
  orders.unshift(order);
  createBill(order, input.waiterId);
  return order;
}

export async function getOrder(id: string): Promise<Order | null> {
  await mockDelay(200);
  return orders.find((o) => o.id === id) ?? null;
}
