import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BankBadge } from '@/components/ui/BankBadge';
import { formatMoney } from '@/components/ui/MoneyText';
import { Text } from '@/components/ui/Text';
import { formatDay, formatTime } from '@/lib/format';
import type { FailedCheck } from '@/lib/verification';

import { ListPiece, RowTag } from './PaymentRow';

/** One bank receipt check that did not verify: where it went, why, who checked it, when. */
export function FailedCheckRow({
  check,
  title,
  showDate,
  position = 'single',
}: {
  check: FailedCheck;
  /** "To CBE"; defaults to the bank code. */
  title?: string;
  showDate: boolean;
  position?: 'single' | 'first' | 'middle' | 'last';
}) {
  const { t } = useTranslation();
  const when = showDate
    ? `${formatDay(check.createdAt, false)}, ${formatTime(check.createdAt)}`
    : formatTime(check.createdAt);
  const heading = title ?? t('transactions.toBank', { bank: check.bankCode });
  const label = check.label ?? t('history.failed.noBill');
  const duplicate = check.reasons.includes('DUPLICATE');
  const tag = duplicate
    ? t('transactions.tag.duplicate')
    : check.status === 'not_matching'
      ? t('transactions.tag.mismatch')
      : t('transactions.tag.failed');
  // Mismatch: what the receipt says next to what was expected ("500 / 540").
  const received = check.receiptAmountEtb;
  const showExpected = !duplicate && received !== null && received !== check.expectedAmountEtb;
  const [reason] = check.reasons;
  const why = reason
    ? t(
        check.status === 'not_matching'
          ? `verifyBank.check.reasons.${reason}`
          : `verifyBank.check.unableReasons.${reason}`
      )
    : '';

  return (
    <ListPiece
      position={position}
      accessibilityLabel={`${heading}, ${tag}, ${why}, ${label}, ${check.checkedBy}, ${when}`}
    >
      <BankBadge code={check.bankCode} size={48} />
      <View className="min-w-0 flex-1">
        <Text font="bold" className="text-base" numberOfLines={1}>
          {heading}
        </Text>
        <Text tone="muted" className="mt-0.5 text-sm" numberOfLines={1}>
          {when} · {label} · {check.checkedBy}
        </Text>
      </View>
      <View className="items-end gap-1">
        <Text font="heading" className="text-base" numberOfLines={1}>
          {formatMoney(received ?? check.expectedAmountEtb, false)}
          {showExpected ? (
            <Text tone="muted" font="bold" className="text-sm">
              {' '}
              {t('transactions.expectedOf', {
                amount: formatMoney(check.expectedAmountEtb, false),
              })}
            </Text>
          ) : null}
        </Text>
        <RowTag label={tag} ok={false} />
      </View>
    </ListPiece>
  );
}
