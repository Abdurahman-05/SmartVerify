export interface Tip {
  id: string;
  billId: string;
  label: string;
  amount: number;
  source: 'bank' | 'cash';
  waiterId: string;
  /** From the server; the mock store does not keep it. */
  waiterName?: string;
  createdAt: string;
  /** Paid out to the waiter by the owner/manager. */
  paidOut: boolean;
}
