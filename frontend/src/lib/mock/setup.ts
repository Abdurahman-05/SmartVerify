import { mockDelay } from './mock';
import type { DeliveryArea, Table, TableArea } from './restaurant';

export interface FeesInput {
  packingFeeEtb: number;
  /** Areas with an id are updated; without an id they are added; missing ones are removed. */
  deliveryAreas: { id?: string; name: string; usualFeeEtb: number }[];
}

// Offline sample for the Tables and Fees setup screens (kept only in memory).
let tables: Table[] = [1, 2, 3, 4].map((n) => ({
  id: `t-main-${n}`,
  number: n,
  area: 'main',
  busy: false,
}));
let fees = {
  packingFeeEtb: 30,
  deliveryAreas: [{ id: 'a-bole', name: 'Bole', usualFeeEtb: 80 }] as DeliveryArea[],
};

const sorted = () =>
  [...tables].sort((a, b) => a.area.localeCompare(b.area) || a.number - b.number);

export async function getSetupTables(): Promise<Table[]> {
  await mockDelay(300);
  return sorted();
}

export async function addTables(area: TableArea, numbers: number[]): Promise<Table[]> {
  await mockDelay(500);
  for (const number of numbers) {
    if (!tables.some((t) => t.area === area && t.number === number)) {
      tables.push({ id: `t-${area}-${number}`, number, area, busy: false });
    }
  }
  return sorted();
}

export async function removeTable(id: string): Promise<void> {
  await mockDelay(400);
  tables = tables.filter((t) => t.id !== id);
}

export async function getSetupFees() {
  await mockDelay(300);
  return fees;
}

export async function saveFees(input: FeesInput) {
  await mockDelay(600);
  fees = {
    packingFeeEtb: input.packingFeeEtb,
    deliveryAreas: input.deliveryAreas.map((a, i) => ({
      id: a.id ?? `a-${Date.now()}-${i}`,
      name: a.name,
      usualFeeEtb: a.usualFeeEtb,
    })),
  };
  return fees;
}
