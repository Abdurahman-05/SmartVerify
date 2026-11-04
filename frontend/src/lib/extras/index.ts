import * as real from '@/lib/api/extras';
import * as mock from '@/lib/mock/extras';

export type {
  BoughtInput,
  BuyItem,
  BuyStatus,
  BuyWhen,
  Features,
  NewBuyItem,
  NewSpending,
  PaidFrom,
  Spending,
  SpendingCategory,
  SpendingsResult,
} from '@/lib/mock/extras';

/** EXPO_PUBLIC_USE_MOCK_EXTRAS=true uses the offline mock (src/lib/mock/extras.ts); default is the real backend. */
export const USE_MOCK_EXTRAS = process.env.EXPO_PUBLIC_USE_MOCK_EXTRAS === 'true';

const impl = USE_MOCK_EXTRAS ? mock : real;
export const getFeatures = impl.getFeatures;
export const updateFeatures = impl.updateFeatures;
export const getBuyItems = impl.getBuyItems;
export const addBuyItem = impl.addBuyItem;
export const removeBuyItem = impl.removeBuyItem;
export const markBought = impl.markBought;
export const getSpendings = impl.getSpendings;
export const addSpending = impl.addSpending;

/** React Query keys. Buy list and money out start with their own name so one call reloads all. */
export const buyItemsKey = ['buy-items'] as const;
export const spendingsKey = ['spendings'] as const;

// ─── Money flow and owner control ────────────────────────────────────────────
export type {
  Expense,
  ExpenseCategory,
  ExpenseChange,
  ExpenseRange,
  ExpensesResult,
  MoneyFlow,
  MoneySplit,
  NewExpense,
} from '@/lib/api/extras';

/** What the server counts as business costs until the owner changes it. */
export const defaultCostKinds: real.ExpenseCategory[] = [
  'RENT',
  'SALARY',
  'GAS',
  'REPAIRS',
  'TRANSPORT',
  'BILLS',
];

/** Every kind, in the order the add sheet shows them. */
export const expenseCategories: real.ExpenseCategory[] = [
  'FOOD',
  'DRINKS',
  'GAS',
  'RENT',
  'SALARY',
  'REPAIRS',
  'TRANSPORT',
  'BILLS',
  'OTHER',
];

// The offline mock only keeps plain spendings: they show as reviewed, never changed or deleted.
const asExpense = (s: Awaited<ReturnType<typeof mock.addSpending>>): real.Expense => ({
  ...s,
  isNew: false,
  changedAt: null,
  changedBy: null,
  oldAmount: null,
  deletedAt: null,
  deleteReason: null,
  hasReceipt: true,
  forBusiness: true,
  isCost: defaultCostKinds.includes(s.category),
});

async function mockExpenses(): Promise<real.ExpensesResult> {
  const result = await mock.getSpendings();
  return { ...result, entries: result.entries.map(asExpense), newCount: 0 };
}

async function mockExpense(id: string): Promise<real.Expense> {
  const found = (await mockExpenses()).entries.find((e) => e.id === id);
  if (!found) throw new Error('NOT_FOUND');
  return found;
}

export const getExpenses: typeof real.getExpenses = USE_MOCK_EXTRAS
  ? () => mockExpenses()
  : real.getExpenses;
export const getExpense: typeof real.getExpense = USE_MOCK_EXTRAS ? mockExpense : real.getExpense;
export const addExpense: typeof real.addExpense = USE_MOCK_EXTRAS
  ? async (input) =>
      asExpense(
        await mock.addSpending({
          ...input,
          category:
            (['FOOD', 'TRANSPORT', 'BILLS'] as const).find((c) => c === input.category) ?? 'OTHER',
        })
      )
  : real.addExpense;
export const reviewExpense: typeof real.reviewExpense = USE_MOCK_EXTRAS
  ? mockExpense
  : real.reviewExpense;
export const changeExpense: typeof real.changeExpense = USE_MOCK_EXTRAS
  ? (id) => mockExpense(id)
  : real.changeExpense;
export const deleteExpense: typeof real.deleteExpense = USE_MOCK_EXTRAS
  ? (id) => mockExpense(id)
  : real.deleteExpense;
export const getMoneyFlow: typeof real.getMoneyFlow = USE_MOCK_EXTRAS
  ? async () => {
      const { totals } = await mock.getSpendings();
      const out = { total: totals.cash + totals.bank, cash: totals.cash, bank: totals.bank };
      const none = { total: 0, cash: 0, bank: 0 };
      const left = { total: -out.total, cash: -out.cash, bank: -out.bank };
      return {
        sales: none,
        expenses: out,
        left,
        costs: none,
        other: out,
        profit: 0,
        byCategory: [],
        newCount: 0,
      };
    }
  : real.getMoneyFlow;

let mockCostKinds = defaultCostKinds;
export const getCostKinds: typeof real.getCostKinds = USE_MOCK_EXTRAS
  ? async () => mockCostKinds
  : real.getCostKinds;
export const setCostKinds: typeof real.setCostKinds = USE_MOCK_EXTRAS
  ? async (kinds) => (mockCostKinds = kinds)
  : real.setCostKinds;
export const costKindsKey = ['cost-kinds'] as const;

export const expensesKey = (range: real.ExpenseRange) =>
  ['spendings', range.day ?? range.period] as const;
export const expenseKey = (id: string) => ['spendings', 'one', id] as const;
export const moneyFlowKey = (range: real.ExpenseRange) =>
  ['money-flow', range.day ?? range.period] as const;
