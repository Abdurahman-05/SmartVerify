import { Banknote, Landmark, Wallet, type LucideIcon } from 'lucide-react-native';

import type { PayMethod } from '@/lib/history';

/** i18n key of a payment method label. */
export const methodKey = (method: PayMethod) =>
  `history.method.${method === 'cash+bank' ? 'cashBank' : method}`;

export const methodIcon: Record<PayMethod, LucideIcon> = {
  cash: Banknote,
  bank: Landmark,
  'cash+bank': Wallet,
};
