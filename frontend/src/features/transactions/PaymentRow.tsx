import { Banknote } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BankBadge } from '@/components/ui/BankBadge';
import { IconTile } from '@/components/ui/IconTile';
import { formatMoney, MoneyText } from '@/components/ui/MoneyText';
import { Text } from '@/components/ui/Text';
import { formatTime } from '@/lib/format';
import type { PaymentRecord } from '@/lib/history';
import { colors } from '@/theme/tokens';
import { GlassCard } from '@/ui/glass';

type Position = 'single' | 'first' | 'middle' | 'last';

const R = 20;
/** Corner radii of one piece of a connected glass list. */
export const pieceRadius = (position: Position = 'single') => ({
  borderTopLeftRadius: position === 'single' || position === 'first' ? R : 0,
  borderTopRightRadius: position === 'single' || position === 'first' ? R : 0,
  borderBottomLeftRadius: position === 'single' || position === 'last' ? R : 0,
  borderBottomRightRadius: position === 'single' || position === 'last' ? R : 0,
});

/** Green (ok) or red (problem) status tag under a row's amount. */
export function RowTag({ label, ok }: { label: string; ok: boolean }) {
  return (
    <View className={`h-7 justify-center rounded-full px-3 ${ok ? 'bg-successBg' : 'bg-dangerBg'}`}>
      <Text
        font="bold"
        className="text-sm"
        style={{ color: ok ? colors.successFg : colors.dangerFg }}
      >
        {label}
      </Text>
    </View>
  );
}

/** One piece of a connected glass list: rounded ends, a hairline between rows. */
export function ListPiece({
  position = 'single',
  onPress,
  accessibilityLabel,
  children,
}: {
  position?: Position;
  onPress?: () => void;
  accessibilityLabel: string;
  children: ReactNode;
}) {
  const joined = position === 'middle' || position === 'last';
  return (
    <GlassCard
      onPress={onPress}
      accessible
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      radius={0}
      className="flex-row items-center gap-3 px-4 py-3"
      style={[pieceRadius(position), joined ? { borderTopWidth: 0 } : null]}
    >
      {joined ? <View className="absolute left-4 right-4 top-0 h-px bg-black/[0.07]" /> : null}
      {children}
    </GlassCard>
  );
}

interface PaymentRowProps {
  payment: PaymentRecord;
  /** "To CBE · Shewa", "To Telebirr" or "Cash". */
  title: string;
  onPress: () => void;
  position?: Position;
}

/** One paid bill: where the money went, time · bill · staff, the amount and its status. */
export function PaymentRow({ payment, title, onPress, position = 'single' }: PaymentRowProps) {
  const { t } = useTranslation();
  const time = formatTime(payment.createdAt);
  const bank = payment.bankCode;
  const verified = payment.method !== 'cash';

  return (
    <ListPiece
      position={position}
      onPress={onPress}
      accessibilityLabel={`${title}, ${formatMoney(payment.salesEtb)}, ${payment.label}, ${payment.waiterName}, ${time}`}
    >
      {bank ? (
        <BankBadge code={bank} size={48} />
      ) : (
        <IconTile icon={Banknote} size={48} radius={14} iconSize={22} />
      )}
      <View className="min-w-0 flex-1">
        <Text font="bold" className="text-base" numberOfLines={1}>
          {title}
        </Text>
        <Text tone="muted" className="mt-0.5 text-sm" numberOfLines={1}>
          {time} · {payment.label} · {payment.waiterName}
        </Text>
        {payment.method === 'cash+bank' ? (
          // Paid partly each way: how much came in cash and how much by bank.
          <Text font="semibold" className="mt-0.5 text-sm" numberOfLines={1}>
            {t('history.split', {
              cash: formatMoney(payment.cashEtb, false),
              bank: formatMoney(payment.bankEtb, false),
            })}
          </Text>
        ) : null}
      </View>
      <View className="items-end gap-1">
        <MoneyText
          value={payment.salesEtb}
          showCurrency={false}
          font="heading"
          className="text-base"
        />
        {verified ? <RowTag label={t('transactions.tag.verified')} ok /> : null}
        {payment.tipEtb > 0 ? (
          <Text tone="muted" className="text-sm">
            {t('history.tipFor', { amount: formatMoney(payment.tipEtb, false) })}
          </Text>
        ) : null}
      </View>
    </ListPiece>
  );
}
