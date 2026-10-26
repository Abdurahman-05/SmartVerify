import { mockDelay } from './mock';

/** Which owner extras are on. Off means hidden everywhere in the app. */
export interface Features {
  featureBuyList: boolean;
  featureMoneyOut: boolean;
}

export type BuyWhen = 'TODAY' | 'WEEK';
export type BuyStatus = 'OPEN' | 'BOUGHT';
export type PaidFrom = 'CASH' | 'BANK';
export type SpendingCategory = 'FOOD' | 'TRANSPORT' | 'BILLS' | 'OTHER';

/** Something the kitchen has run out of. */
export interface BuyItem {
  id: string;
  name: string;
  /** Free text, e.g. "3 boxes". */
  qty: string | null;
  when: BuyWhen;
  status: BuyStatus;
  price: number | null;
  paidFrom: PaidFrom | null;
  createdBy: string;
  boughtBy: string | null;
  createdAt: string;
  boughtAt: string | null;
}

export interface NewBuyItem {
  name: string;
  qty?: string;
  when: BuyWhen;
}

export interface BoughtInput {
  /** Integer ETB. */
  price: number;
  paidFrom: PaidFrom;
}

/** Money paid out (not a sale). */
export interface Spending {
  id: string;
  title: string;
  amount: number;
  category: SpendingCategory;
  paidFrom: PaidFrom;
  buyItemId: string | null;
  createdBy: string;
  createdAt: string;
}

export type NewSpending = Pick<Spending, 'title' | 'amount' | 'category' | 'paidFrom'>;

export interface SpendingsResult {
  entries: Spending[];
  /** today and week are fixed periods; cash and bank add up the entries listed. */
  totals: { today: number; week: number; cash: number; bank: number };
}

// Offline sample (in memory): both extras on, so every screen can be tried.
let features: Features = { featureBuyList: true, featureMoneyOut: true };
let buyItems: BuyItem[] = [];
let spendings: Spending[] = [];

export async function getFeatures(): Promise<Features> {
  await mockDelay(200);
  return features;
}

export async function updateFeatures(changes: Partial<Features>): Promise<Features> {
  await mockDelay(300);
  features = { ...features, ...changes };
  return features;
}

export async function getBuyItems(status?: BuyStatus): Promise<BuyItem[]> {
  await mockDelay(300);
  return buyItems.filter((item) => !status || item.status === status);
}

export async function addBuyItem(input: NewBuyItem): Promise<BuyItem> {
  await mockDelay(300);
  const item: BuyItem = {
    id: `b-${Date.now()}-${buyItems.length}`,
    name: input.name.trim(),
    qty: input.qty?.trim() || null,
    when: input.when,
    status: 'OPEN',
    price: null,
    paidFrom: null,
    createdBy: 'Chef',
    boughtBy: null,
    createdAt: new Date().toISOString(),
    boughtAt: null,
  };
  buyItems = [item, ...buyItems];
  return item;
}

export async function removeBuyItem(id: string): Promise<void> {
  await mockDelay(300);
  buyItems = buyItems.filter((item) => item.id !== id);
}

export async function markBought(id: string, input: BoughtInput): Promise<BuyItem> {
  await mockDelay(400);
  const found = buyItems.find((item) => item.id === id);
  if (!found || found.status !== 'OPEN') throw new Error('CONFLICT');
  const bought: BuyItem = {
    ...found,
    ...input,
    status: 'BOUGHT',
    boughtBy: 'Manager',
    boughtAt: new Date().toISOString(),
  };
  buyItems = buyItems.map((item) => (item.id === id ? bought : item));
  if (features.featureMoneyOut) {
    await addSpending({
      title: found.qty ? `${found.name} (${found.qty})` : found.name,
      amount: input.price,
      category: 'FOOD',
      paidFrom: input.paidFrom,
    });
  }
  return bought;
}

export async function getSpendings(): Promise<SpendingsResult> {
  await mockDelay(300);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const sum = (from: Date, paidFrom?: PaidFrom) =>
    spendings
      .filter((s) => new Date(s.createdAt) >= from && (!paidFrom || s.paidFrom === paidFrom))
      .reduce((total, s) => total + s.amount, 0);
  const weekStart = new Date(startOfToday.getTime() - 6 * 86_400_000);
  return {
    entries: spendings.filter((s) => new Date(s.createdAt) >= startOfToday),
    totals: {
      today: sum(startOfToday),
      week: sum(weekStart),
      cash: sum(startOfToday, 'CASH'),
      bank: sum(startOfToday, 'BANK'),
    },
  };
}

export async function addSpending(input: NewSpending): Promise<Spending> {
  await mockDelay(300);
  const spending: Spending = {
    ...input,
    title: input.title.trim(),
    id: `s-${Date.now()}-${spendings.length}`,
    buyItemId: null,
    createdBy: 'Manager',
    createdAt: new Date().toISOString(),
  };
  spendings = [spending, ...spendings];
  return spending;
}
