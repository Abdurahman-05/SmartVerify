import { create } from 'zustand';

import type { Bill } from './types';

const todayAt = (hours: number, minutes: number) => {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
};

const line = (itemId: string, name: string, priceEtb: number, quantity: number) => ({
  itemId,
  name,
  priceEtb,
  quantity,
});

const dineBill = (
  bill: Pick<Bill, 'id' | 'orderNo' | 'tableNo' | 'guests' | 'items' | 'servedStatus' | 'createdAt' | 'waiterId' | 'waiterName'>
): Bill => {
  const foodTotal = bill.items.reduce((sum, l) => sum + l.priceEtb * l.quantity, 0);
  return {
    ...bill,
    type: 'dine',
    tableArea: 'main',
    foodTotal,
    packingFee: 0,
    deliveryFee: 0,
    total: foodTotal,
    status: 'open',
  };
};

const seedBills: Bill[] = [
  dineBill({
    id: 'bill-1042',
    orderNo: 1042,
    tableNo: 12,
    guests: 4,
    waiterId: 'mock-user-1',
    waiterName: 'Abebe',
    servedStatus: 'served',
    createdAt: todayAt(10, 5),
    items: [
      line('m-firfir', 'Special Firfir', 190, 1),
      line('m-dorowat', 'Doro Wat', 150, 2),
      line('m-shiro', 'Shiro Tegabino', 110, 3),
      line('m-ambo', 'Ambo Sparkling Water', 45, 4),
    ],
  }),
  dineBill({
    id: 'bill-1040',
    orderNo: 1040,
    tableNo: 8,
    guests: 2,
    waiterId: 'waiter-dawit',
    waiterName: 'Dawit G.',
    servedStatus: 'served',
    createdAt: todayAt(10, 20),
    items: [line('m-kitfo', 'Kitfo', 260, 3), line('m-tibs', 'Beef Tibs', 220, 2), line('m-tea', 'Shai (Tea)', 30, 1)],
  }),
  dineBill({
    id: 'bill-1041',
    orderNo: 1041,
    tableNo: 3,
    guests: 3,
    waiterId: 'waiter-dawit',
    waiterName: 'Dawit G.',
    servedStatus: 'served',
    createdAt: todayAt(10, 32),
    items: [line('m-dorowat', 'Doro Wat', 150, 2), line('m-coffee', 'Buna (Coffee)', 40, 2)],
  }),
  dineBill({
    id: 'bill-1039',
    orderNo: 1039,
    tableNo: 5,
    guests: 5,
    waiterId: 'mock-user-1',
    waiterName: 'Abebe',
    servedStatus: 'kitchen',
    createdAt: todayAt(10, 48),
    items: [line('m-beyaynetu', 'Beyaynetu', 140, 4), line('m-coffee', 'Buna (Coffee)', 40, 2)],
  }),
];

interface BillsState {
  bills: Bill[];
  addBill: (bill: Bill) => void;
  markPaid: (id: string) => void;
  setServed: (id: string) => void;
}

export const useBills = create<BillsState>((set) => ({
  bills: seedBills,
  addBill: (bill) => set((s) => ({ bills: [...s.bills, bill] })),
  markPaid: (id) =>
    set((s) => ({ bills: s.bills.map((b) => (b.id === id ? { ...b, status: 'paid' } : b)) })),
  setServed: (id) =>
    set((s) => ({ bills: s.bills.map((b) => (b.id === id ? { ...b, servedStatus: 'served' } : b)) })),
}));

export const openBills = (bills: Bill[]) =>
  bills
    .filter((b) => b.status === 'open')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
