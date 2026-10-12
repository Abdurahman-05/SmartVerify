import type { TFunction } from 'i18next';

import { formatMoney } from '@/components/ui/MoneyText';
import type { ExportTable } from '@/lib/export';
import { formatDay, formatTime } from '@/lib/format';
import type { PaymentRecord } from '@/lib/history';

import { methodKey } from './methods';

/** PDF statement of paid bills (sales; tips shown apart). */
export function buildStatement(
  t: TFunction,
  payments: PaymentRecord[],
  methodLabel: string,
  periodLabel: string,
  businessName: string
): ExportTable {
  const total = payments.reduce((sum, p) => sum + p.salesEtb, 0);
  return {
    title: `${t('history.statementTitle')} · ${methodLabel}`,
    subtitle: `${businessName} · ${periodLabel}`,
    columns: [
      t('history.columns.date'),
      t('history.columns.bill'),
      t('history.columns.method'),
      t('history.columns.waiter'),
      t('history.columns.cash'),
      t('history.columns.bank'),
      t('history.columns.tip'),
      t('history.columns.total'),
    ],
    rows: payments.map((p) => [
      `${formatDay(p.createdAt)} ${formatTime(p.createdAt)}`,
      p.label,
      t(methodKey(p.method)),
      p.waiterName,
      formatMoney(p.cashEtb, false),
      formatMoney(p.bankEtb, false),
      formatMoney(p.tipEtb, false),
      formatMoney(p.salesEtb, false),
    ]),
    footer: t('history.total', { amount: formatMoney(total, false) }),
  };
}
