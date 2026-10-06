import { useTranslation } from 'react-i18next';

import { StatusPill } from '@/components/ui/StatusPill';

import type { Bill } from './types';

export function BillPill({ bill, className }: { bill: Bill; className?: string }) {
  const { t } = useTranslation();
  if (bill.status === 'paid') {
    return <StatusPill status="verified" label={t('bills.paid')} className={className} />;
  }
  return bill.servedStatus === 'served' ? (
    <StatusPill status="verified" label={t('bills.served')} className={className} />
  ) : (
    <StatusPill status="pending" label={t('bills.inKitchen')} className={className} />
  );
}
