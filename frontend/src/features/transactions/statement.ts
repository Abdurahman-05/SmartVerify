import type { TFunction } from 'i18next';

import { formatMoney } from '@/components/ui/MoneyText';
import { accountFor, type Transaction } from '@/lib/mock/transactions';
import type { ExportTable } from '@/lib/export';
import { formatDay, formatTime } from '@/lib/format';

export function buildStatement(
  t: TFunction,
  transactions: Transaction[],
  bankName: string,
  periodLabel: string,
  businessName: string
): ExportTable {
  const verifiedTotal = transactions
    .filter((tx) => tx.status === 'verified')
    .reduce((sum, tx) => sum + tx.receivedAmount, 0);

  return {
    title: t('transactions.statementTitle', { bank: bankName }),
    subtitle: `${businessName} · ${periodLabel}`,
    columns: [
      t('transactions.columns.date'),
      t('transactions.columns.payer'),
      t('transactions.columns.bank'),
      t('transactions.columns.reference'),
      t('transactions.columns.expected'),
      t('transactions.columns.received'),
      t('transactions.columns.status'),
    ],
    rows: transactions.map((tx) => [
      `${formatDay(tx.createdAt)} ${formatTime(tx.createdAt)}`,
      tx.payerName,
      accountFor(tx).shortName,
      tx.reference,
      formatMoney(tx.expectedAmount, false),
      formatMoney(tx.receivedAmount, false),
      t(`status.${tx.status}`),
    ]),
    footer: t('transactions.totalVerified', { amount: formatMoney(verifiedTotal, false) }),
  };
}
