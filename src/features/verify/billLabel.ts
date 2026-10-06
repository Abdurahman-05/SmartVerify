import type { TFunction } from 'i18next';

import type { Bill } from '@/features/bills/types';

export function billLabel(t: TFunction, bill: Bill) {
  switch (bill.type) {
    case 'dine':
      return t('verifyRestaurant.forTable', { number: bill.tableNo });
    case 'takeaway':
      return t('verifyRestaurant.forTakeaway', { number: bill.orderNo });
    case 'delivery':
      return t('verifyRestaurant.forDelivery', { number: bill.orderNo });
  }
}
