import { TextInput, View, type TextInputProps } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors } from '@/theme/tokens';

interface FieldProps extends TextInputProps {
  label: string;
  error?: string;
  emphasis?: boolean;
}

/** Compact labelled input used in the takeaway and delivery forms. */
export function Field({ label, error, emphasis, ...inputProps }: FieldProps) {
  return (
    <View className="gap-1">
      <Text font="bold" className="text-[15px]">
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.placeholder}
        className={`h-[50px] rounded-[14px] border-2 bg-surface px-3.5 text-text ${
          emphasis ? 'text-right font-body-bold text-xl' : 'font-body text-[17px]'
        } ${error ? 'border-dangerFg' : emphasis ? 'border-primary' : 'border-borderStrong'}`}
        {...inputProps}
      />
      {error ? (
        <Text font="semibold" className="text-sm text-dangerFg">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
