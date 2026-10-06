export interface Tip {
  id: string;
  billId: string;
  label: string;
  amount: number;
  source: 'bank' | 'cash';
  waiterId: string;
  createdAt: string;
  paidOut: false;
}
