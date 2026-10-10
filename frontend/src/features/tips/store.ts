import { create } from 'zustand';

import type { Tip } from './types';

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3600_000).toISOString();

const seedTips: Tip[] = [
  { id: 'tip-seed-1', billId: 'bill-1031', label: 'Table 7', amount: 200, source: 'bank', waiterId: 'mock-user-1', createdAt: hoursAgo(1), paidOut: false },
  { id: 'tip-seed-2', billId: 'bill-1029', label: 'Table 2', amount: 50, source: 'cash', waiterId: 'mock-user-1', createdAt: hoursAgo(2), paidOut: false },
  { id: 'tip-seed-3', billId: 'bill-1012', label: 'Table 9', amount: 100, source: 'bank', waiterId: 'mock-user-1', createdAt: hoursAgo(50), paidOut: false },
  { id: 'tip-seed-4', billId: 'bill-0988', label: 'Table 4', amount: 150, source: 'cash', waiterId: 'mock-user-1', createdAt: hoursAgo(200), paidOut: false },
];

interface TipsState {
  tips: Tip[];
  addTip: (tip: Tip) => void;
}

export const useTips = create<TipsState>((set) => ({
  tips: seedTips,
  addTip: (tip) => set((s) => ({ tips: [...s.tips, tip] })),
}));
