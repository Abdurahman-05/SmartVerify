import type { Table, TableArea } from '@/lib/mock/restaurant';
import type { FeesInput } from '@/lib/mock/setup';

import { api } from './client';
import type { Fees } from './restaurant';

/** POST /tables — adds table numbers to an area (existing ones are skipped). Returns all tables. */
export async function addTables(area: TableArea, numbers: number[]): Promise<Table[]> {
  const tables = await api<(Table & { openBillId: string | null })[]>('/tables', {
    method: 'POST',
    body: { area, numbers },
  });
  return tables.map(({ id, number, area: a, busy }) => ({ id, number, area: a, busy }));
}

/** DELETE /tables/:id — removes a table from use (TABLE_BUSY while it has an open bill). */
export async function removeTable(id: string): Promise<void> {
  await api(`/tables/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** PUT /fees — saves the packing fee and the whole delivery-area list at once. */
export const saveFees = (input: FeesInput) => api<Fees>('/fees', { method: 'PUT', body: input });
