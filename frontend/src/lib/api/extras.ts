import type {
  BoughtInput,
  BuyItem,
  BuyStatus,
  Features,
  NewBuyItem,
  NewSpending,
  Spending,
  SpendingsResult,
} from '@/lib/mock/extras';

import { api } from './client';

/** GET /business/features — which owner extras are on (any member). */
export const getFeatures = () => api<Features>('/business/features');

/** PATCH /business/features — owner only. Off only hides a feature; its data is kept. */
export const updateFeatures = (changes: Partial<Features>) =>
  api<Features>('/business/features', { method: 'PATCH', body: changes });

/** GET /buy-items?status= — chef, manager, owner. 403 while the buy list is off. */
export const getBuyItems = (status?: BuyStatus) =>
  api<BuyItem[]>('/buy-items', { query: { status } });

/** POST /buy-items — chef or owner. */
export const addBuyItem = (input: NewBuyItem) =>
  api<BuyItem>('/buy-items', { method: 'POST', body: input });

/** DELETE /buy-items/:id — a chef's own open item, or any item for the owner. */
export async function removeBuyItem(id: string): Promise<void> {
  await api(`/buy-items/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** POST /buy-items/:id/bought — manager or owner. With Money out on, a spending is added too. */
export const markBought = (id: string, input: BoughtInput) =>
  api<BuyItem>(`/buy-items/${encodeURIComponent(id)}/bought`, { method: 'POST', body: input });

/** GET /spendings — today's entries and the totals (manager, owner). 403 while Money out is off. */
export const getSpendings = () => api<SpendingsResult>('/spendings');

/** POST /spendings — manager or owner. */
export const addSpending = (input: NewSpending) =>
  api<Spending>('/spendings', { method: 'POST', body: input });

// ─── Money flow and owner control ────────────────────────────────────────────

/** Every kind of expense the server takes (the mock knows only the first four). */
export type ExpenseCategory =
  'FOOD' | 'DRINKS' | 'GAS' | 'RENT' | 'SALARY' | 'REPAIRS' | 'TRANSPORT' | 'BILLS' | 'OTHER';

/** An expense as the server sends it now: with the owner's review, change and delete. */
export interface Expense extends Omit<Spending, 'category'> {
  category: ExpenseCategory;
  /** Added by someone else and not yet looked at by the owner. */
  isNew: boolean;
  changedAt: string | null;
  changedBy: string | null;
  /** The amount before the owner's last change. */
  oldAmount: number | null;
  /** Deleted by the owner: still listed (crossed out), never counted. */
  deletedAt: string | null;
  deleteReason: string | null;
  hasReceipt: boolean;
  /** false: personal use, not the business's. */
  forBusiness: boolean;
  /** A business cost: a kind the owner counts, with a receipt, for the business. */
  isCost: boolean;
}

export interface ExpensesResult extends Omit<SpendingsResult, 'entries'> {
  entries: Expense[];
  newCount: number;
}

/** today / 7 days / 30 days, or one day (YYYY-MM-DD). */
export interface ExpenseRange {
  period: 'today' | '7d' | '30d';
  day?: string;
}

export interface MoneySplit {
  total: number;
  cash: number;
  bank: number;
}

export interface MoneyFlow {
  sales: MoneySplit;
  expenses: MoneySplit;
  /** Sales − expenses (can be below 0). */
  left: MoneySplit;
  /** Business costs (the kinds the owner counts). */
  costs: MoneySplit;
  /** Everything else spent. */
  other: MoneySplit;
  /** Sales − business costs. */
  profit: number;
  byCategory: { category: ExpenseCategory; amount: number; share: number }[];
  newCount: number;
}

export interface ExpenseChange {
  title?: string;
  amount?: number;
  category?: ExpenseCategory;
  paidFrom?: Spending['paidFrom'];
  hasReceipt?: boolean;
  forBusiness?: boolean;
}

export interface NewExpense extends Omit<NewSpending, 'category'> {
  category: ExpenseCategory;
  hasReceipt: boolean;
  forBusiness: boolean;
}

/** GET /spendings?period|date — the list, totals and how many are new. */
export const getExpenses = ({ period, day }: ExpenseRange) =>
  api<ExpensesResult>('/spendings', { query: { period, date: day } });

/** GET /spendings/:id */
export const getExpense = (id: string) => api<Expense>(`/spendings/${encodeURIComponent(id)}`);

/** POST /spendings with any kind (the server takes all of them). */
export const addExpense = (input: NewExpense) =>
  api<Expense>('/spendings', { method: 'POST', body: input });

/** POST /spendings/:id/review — owner: "looks right". */
export const reviewExpense = (id: string) =>
  api<Expense>(`/spendings/${encodeURIComponent(id)}/review`, { method: 'POST' });

/** PATCH /spendings/:id — owner: correct it (kept in its history). */
export const changeExpense = (id: string, change: ExpenseChange) =>
  api<Expense>(`/spendings/${encodeURIComponent(id)}`, { method: 'PATCH', body: change });

/** POST /spendings/:id/delete — owner, with a reason; the person who added it is told. */
export const deleteExpense = (id: string, reason: string) =>
  api<Expense>(`/spendings/${encodeURIComponent(id)}/delete`, {
    method: 'POST',
    body: { reason },
  });

/** GET /business/cost-kinds — the kinds the owner counts as business costs. */
export const getCostKinds = () =>
  api<{ kinds: ExpenseCategory[] }>('/business/cost-kinds').then((r) => r.kinds);

/** PUT /business/cost-kinds — owner. */
export const setCostKinds = (kinds: ExpenseCategory[]) =>
  api<{ kinds: ExpenseCategory[] }>('/business/cost-kinds', {
    method: 'PUT',
    body: { kinds },
  }).then((r) => r.kinds);

/** GET /money-flow — owner, or a manager allowed to see reports. */
export const getMoneyFlow = ({ period, day }: ExpenseRange) =>
  api<MoneyFlow>('/money-flow', { query: { period, date: day } });
