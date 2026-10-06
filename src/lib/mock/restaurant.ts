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
  { id: 'm-combo-family', name: 'Family Combo', priceEtb: 650, category: 'combos' },
  { id: 'm-combo-fasting', name: 'Fasting Combo', priceEtb: 320, category: 'combos' },
];

const busyTables = new Set(['main-3', 'main-5', 'main-9', 'upstairs-2', 'outside-4']);

const tables: Table[] = (
  [
    ['main', 16],
    ['upstairs', 8],
    ['outside', 6],
  ] as const
).flatMap(([area, count]) =>
  Array.from({ length: count }, (_, i) => {
    const id = `${area}-${i + 1}`;
    return { id, number: i + 1, area, busy: busyTables.has(id) };
  })
);

export const deliveryAreas: DeliveryArea[] = [
  { id: 'bole', name: 'Bole', usualFeeEtb: 80 },
  { id: 'kazanchis', name: 'Kazanchis', usualFeeEtb: 100 },
  { id: 'megenagna', name: 'Megenagna', usualFeeEtb: 100 },
  { id: 'sarbet', name: 'Sarbet', usualFeeEtb: 120 },
  { id: 'piassa', name: 'Piassa', usualFeeEtb: 120 },
  { id: 'cmc', name: 'CMC', usualFeeEtb: 150 },
];

const orders: Order[] = [];
let nextOrderNumber = 1043;

export async function getMenu(): Promise<MenuItem[]> {
  await mockDelay(400);
  return menu;
}

export async function getTables(): Promise<Table[]> {
  await mockDelay(300);
  return tables.map((t) => ({ ...t }));
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
  const { target } = input;
  if (target.type === 'dineIn') {
    const table = tables.find((t) => t.id === target.tableId);
    if (table) table.busy = true;
  }
  return order;
}

export async function getOrder(id: string): Promise<Order | null> {
  await mockDelay(200);
  return orders.find((o) => o.id === id) ?? null;
}
