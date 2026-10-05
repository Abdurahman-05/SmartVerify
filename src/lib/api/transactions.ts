import { periodRange, type Period } from '@/lib/period';

import { mockAccounts, type BankAccount } from './bankAccounts';
import { mockDelay } from './mock';

export type TransactionStatus = 'verified' | 'pending' | 'mismatch' | 'duplicate';

export interface Transaction {
  id: string;
  accountId: string;
  payerName: string;
  reference: string;
  expectedAmount: number;
  receivedAmount: number;
  status: TransactionStatus;
  createdAt: string;
}

export interface TransactionFilter {
  period: Period;
  accountId?: string;
  status?: TransactionStatus;
}

export interface BankReportRow {
  account: BankAccount;
  count: number;
  total: number;
  share: number;
}

export interface BankReport {
  total: number;
  count: number;
  rows: BankReportRow[];
}

const payers = [
  'Dawit Getachew',
  'Almaz Tadesse',
  'Kidus Yohannes',
  'Selamawit Bekele',
  'Hanna Girma',
  'Yonas Alemu',
  'Meron Haile',
  'Biruk Tesfaye',
  'Tigist Mulugeta',
  'Samuel Desta',
];

// Seeded so the mock list looks the same on every launch.
function seededRandom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildMockTransactions(): Transaction[] {
  const random = seededRandom(42);
  const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];
  const weightedAccount = () => {
    const r = random();
    return r < 0.6 ? mockAccounts[0] : r < 0.87 ? mockAccounts[1] : mockAccounts[2];
  };
  const weightedStatus = (): TransactionStatus => {
    const r = random();
    return r < 0.86 ? 'verified' : r < 0.93 ? 'pending' : r < 0.97 ? 'mismatch' : 'duplicate';
  };

  const now = new Date();
  const list: Transaction[] = [];
  let refNo = 9823412;

  for (let day = 0; day < 30; day++) {
    const count = day === 0 ? 24 : 8 + Math.floor(random() * 12);
    const dayStart = new Date(now);
    dayStart.setHours(7, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() - day);
    const dayEnd = day === 0 ? now.getTime() : dayStart.getTime() + 14 * 3600_000;
    const span = Math.max(dayEnd - dayStart.getTime(), 60_000);

    for (let i = 0; i < count; i++) {
      const account = weightedAccount();
      const status = weightedStatus();
      const expectedAmount = (2 + Math.floor(random() * 60)) * 50;
      list.push({
        id: `tx-${refNo}`,
        accountId: account.id,
        payerName: pick(payers),
        reference: `${account.bankCode}-${refNo--}`,
        expectedAmount,
        receivedAmount: status === 'mismatch' ? Math.max(expectedAmount - 100, 50) : expectedAmount,
        status,
        createdAt: new Date(dayEnd - ((i + 0.5) / count) * span).toISOString(),
      });
    }
  }
  return list;
}

let transactions = buildMockTransactions();

export function recordTransaction(tx: Omit<Transaction, 'id'>) {
  transactions = [{ ...tx, id: `tx-${Date.now()}` }, ...transactions];
}

function inPeriod(tx: Transaction, period: Period) {
  const { from, to } = periodRange(period);
  const time = new Date(tx.createdAt).getTime();
  return time >= from.getTime() && time <= to.getTime();
}

export function accountFor(tx: Transaction) {
  return mockAccounts.find((a) => a.id === tx.accountId) ?? mockAccounts[0];
}

export async function getTransactions(filter: TransactionFilter): Promise<Transaction[]> {
  await mockDelay(500);
  return transactions
    .filter((tx) => inPeriod(tx, filter.period))
    .filter((tx) => !filter.accountId || tx.accountId === filter.accountId)
    .filter((tx) => !filter.status || tx.status === filter.status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getTransaction(id: string): Promise<Transaction | null> {
  await mockDelay(300);
  return transactions.find((tx) => tx.id === id) ?? null;
}

/** Only verified payments count as received money. */
export async function getBankReport(period: Period): Promise<BankReport> {
  await mockDelay(500);
  const verified = transactions.filter((tx) => tx.status === 'verified' && inPeriod(tx, period));
  const total = verified.reduce((sum, tx) => sum + tx.receivedAmount, 0);

  const rows = mockAccounts
    .map((account) => {
      const own = verified.filter((tx) => tx.accountId === account.id);
      const accountTotal = own.reduce((sum, tx) => sum + tx.receivedAmount, 0);
      return {
        account,
        count: own.length,
        total: accountTotal,
        share: total ? Math.round((accountTotal / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.total - a.total);

  return { total, count: verified.length, rows };
}

export async function getTodayCounts() {
  const today = transactions.filter((tx) => inPeriod(tx, 'today'));
  return {
    verified: today.filter((tx) => tx.status === 'verified').length,
    pending: today.filter((tx) => tx.status === 'pending').length,
    duplicate: today.filter((tx) => tx.status === 'duplicate').length,
  };
}
