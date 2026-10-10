import i18n from '@/i18n';
import { formatAmount } from '@/lib/format';

import { Text, type TextProps } from './Text';

/** "1,250 ETB" as plain text, for labels, share messages, and exports. */
export const formatMoney = (value: number, showCurrency = true) =>
  showCurrency ? `${formatAmount(value)} ${i18n.t('common.etb')}` : formatAmount(value);

interface MoneyTextProps extends Omit<TextProps, 'children'> {
  value: number;
  size?: number;
  showCurrency?: boolean;
}

export function MoneyText({
  value,
  size,
  showCurrency = true,
  font = 'heading',
  style,
  ...props
}: MoneyTextProps) {
  return (
    <Text font={font} style={[size ? { fontSize: size } : null, style]} {...props}>
      {formatMoney(value, showCurrency)}
    </Text>
  );
}
