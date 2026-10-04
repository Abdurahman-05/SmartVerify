import { Text, TextProps } from 'react-native';

interface MoneyTextProps extends TextProps {
  amount: number;
  showCurrency?: boolean;
}

const formatETB = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const MoneyText = ({
  amount,
  showCurrency = true,
  className,
  ...props
}: MoneyTextProps) => {
  const formatted = formatETB(amount);
  const display = showCurrency ? `ETB ${formatted}` : formatted;

  return (
    <Text className={`font-heading text-lg text-primary ${className || ''}`} {...props}>
      {display}
    </Text>
  );
};
