import ReceiptHistoryScreen from '@/features/transactions/ReceiptHistoryScreen';
import TransactionsScreen from '@/features/transactions/TransactionsScreen';
import { useSession } from '@/store/session';

/** Restaurant Plus: paid bills. Normal Verify: the receipts checked. */
export default function TransactionsRoute() {
  const restaurant = useSession((s) => s.user?.plan === 'restaurant');
  return restaurant ? <TransactionsScreen /> : <ReceiptHistoryScreen />;
}
