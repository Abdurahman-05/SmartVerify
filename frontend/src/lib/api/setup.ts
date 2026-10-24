import type { FeesInput } from '@/lib/mock/setup';

import { api } from './client';
import { toTables, type Fees, type ServerTable, type Table } from './restaurant';

/** POST /tables — adds table numbers to a category (existing ones are skipped). Returns all tables. */
export async function addTables(categoryId: string, numbers: number[]): Promise<Table[]> {
  return toTables(
    await api<ServerTable[]>('/tables', { method: 'POST', body: { categoryId, numbers } })
  );
}

/** DELETE /tables/:id — removes a table from use (TABLE_BUSY while it has an open bill). */
export async function removeTable(id: string): Promise<void> {
  await api(`/tables/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** PUT /fees — saves the packing fee and the whole delivery-area list at once. */
export const saveFees = (input: FeesInput) => api<Fees>('/fees', { method: 'PUT', body: input });
