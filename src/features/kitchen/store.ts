import { create } from 'zustand';

import { useBills } from '@/features/bills/store';

import type { KitchenOrder } from './types';

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const seedOrders: KitchenOrder[] = [
  {
    id: 'k-1042',
    billId: 'bill-1042',
    orderNo: 1042,
    label: 'Table 12',
    type: 'dine',
    waiterName: 'Dawit G.',
    guests: 4,
    items: [
      { qty: 2, name: 'Special Firfir' },
      { qty: 1, name: 'Doro Wat' },
    ],
    notes: ['noOnion', 'lessSpicy'],
    status: 'new',
    createdAt: minutesAgo(12),
  },
  {
    id: 'k-1043',
    billId: 'bill-1043',
    orderNo: 1043,
    label: 'Delivery #1043',
    type: 'delivery',
    waiterName: 'Selam T.',
    area: 'Bole',
    items: [
      { qty: 1, name: 'Shiro Tegabino' },
      { qty: 2, name: 'Ambo Sparkling Water' },
    ],
    notes: [],
    status: 'new',
    createdAt: minutesAgo(5),
  },
  {
    id: 'k-1044',
    billId: 'bill-1044',
    orderNo: 1044,
    label: 'Takeaway #1044',
    type: 'takeaway',
    waiterName: 'Selam T.',
    customerName: 'Mulu T.',
    items: [{ qty: 3, name: 'Doro Wat' }],
    notes: ['rush'],
    status: 'new',
    createdAt: minutesAgo(2),
  },
];

interface KitchenState {
  orders: KitchenOrder[];
  addOrder: (order: KitchenOrder) => void;
  startCooking: (id: string) => void;
  markReady: (id: string) => void;
}

export const useKitchen = create<KitchenState>((set, get) => ({
  orders: seedOrders,
  addOrder: (order) => set((s) => ({ orders: [...s.orders, order] })),
  startCooking: (id) =>
    set((s) => ({
      orders: s.orders.map((o) =>
        o.id === id ? { ...o, status: 'cooking', startedAt: new Date().toISOString() } : o
      ),
    })),
  markReady: (id) => {
    set((s) => ({ orders: s.orders.map((o) => (o.id === id ? { ...o, status: 'ready' } : o)) }));
    const order = get().orders.find((o) => o.id === id);
    if (order) useBills.getState().setServed(order.billId);
  },
}));
