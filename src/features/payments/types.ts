export type PaymentMethod = 'bank' | 'cash+bank' | 'cash';

export interface Payment {
  id: string;
  billId: string;
  method: PaymentMethod;
  cash: number;
  bank: number;
  tip: number;
  waiterId: string;
  waiterName: string;
  createdAt: string;
}
