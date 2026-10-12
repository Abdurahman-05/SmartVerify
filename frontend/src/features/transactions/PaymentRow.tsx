import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { formatMoney, MoneyText } from '@/components/ui/MoneyText';
import { Text } from '@/components/ui/Text';
import { formatDay, formatTime } from '@/lib/format';
import type { PaymentRecord } from '@/lib/history';
import { useBrandColors } from '@/store/theme';

import { methodIcon, methodKey } from './methods';

interface PaymentRowProps {
  payment: PaymentRecord;
  showDate: boolean;
  onPress: () => void;
}

/** One paid bill in History: what was paid, how, when, and the sale amount. */
export function PaymentRow({ payment, showDate, onPress }: PaymentRowProps) {
  const brand = useBrandColors();
  const { t } = useTranslation();
  const Icon = methodIcon[payment.method];
  const method = t(methodKey(payment.method));
  const when = showDate
    ? `${formatDay(payment.createdAt, false)}, ${formatTime(payment.createdAt)}`
    : formatTime(payment.createdAt);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${payment.label}, ${formatMoney(payment.salesEtb)}, ${method}, ${when}`}
      className="flex-row items-center gap-3 rounded-[18px] border-[1.5px] border-border bg-surface p-3 active:bg-background"
    >
      <View className="h-12 w-12 items-center justify-center rounded-[14px] bg-primaryTile">
        <Icon size={24} color={brand.primary} strokeWidth={2.2} />
      </View>
      <View className="min-w-0 flex-1">
        <Text font="bold" className="text-[17px]" numberOfLines={1}>
          {payment.label}
        </Text>
        <Text tone="muted" className="mt-0.5 text-sm" numberOfLines={1}>
          {method} · {payment.waiterName} · {when}
        </Text>
      </View>
      <View className="items-end gap-0.5">
        <MoneyText value={payment.salesEtb} font="bold" tone="link" className="text-lg" />
        {payment.tipEtb > 0 ? (
          <Text tone="muted" className="text-sm">
            {t('history.tipFor', { amount: formatMoney(payment.tipEtb, false) })}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
