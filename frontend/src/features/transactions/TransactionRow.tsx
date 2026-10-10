import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { formatMoney, MoneyText } from '@/components/ui/MoneyText';
import { BankBadge } from '@/components/ui/BankBadge';
import { StatusPill } from '@/components/ui/StatusPill';
import { Text } from '@/components/ui/Text';
import { accountFor, type Transaction } from '@/lib/mock/transactions';
import { formatDay, formatTime } from '@/lib/format';

interface TransactionRowProps {
  transaction: Transaction;
  showDate: boolean;
  onPress: () => void;
}

export function TransactionRow({ transaction, showDate, onPress }: TransactionRowProps) {
  const { t } = useTranslation();
  const account = accountFor(transaction);
  const when = showDate
    ? `${formatDay(transaction.createdAt, false)}, ${formatTime(transaction.createdAt)}`
    : formatTime(transaction.createdAt);
  const amount = `+${formatMoney(transaction.receivedAmount)}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${transaction.payerName}, ${amount}, ${t(`status.${transaction.status}`)}, ${when}`}
      className="flex-row items-center gap-3 rounded-[18px] border-[1.5px] border-border bg-surface p-3 active:bg-background"
    >
      <BankBadge code={account.bankCode} />
      <View className="min-w-0 flex-1">
        <Text font="bold" className="text-[17px]" numberOfLines={1}>
          {transaction.payerName}
        </Text>
        <Text tone="muted" className="mt-0.5 text-sm" numberOfLines={1}>
          {transaction.reference} · {when}
        </Text>
      </View>
      <View className="items-end gap-1">
        <Text
          font="bold"
          className={`text-lg ${transaction.status === 'verified' ? 'text-primaryText' : 'text-muted'}`}
        >
          +<MoneyText value={transaction.receivedAmount} font="bold" className="text-lg" />
        </Text>
        <StatusPill status={transaction.status} />
      </View>
    </Pressable>
  );
}
