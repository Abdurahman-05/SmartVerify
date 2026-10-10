import { forwardRef, type ReactNode } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { colors } from '@/theme/tokens';

import { Text } from './Text';

interface InputProps extends TextInputProps {
  label: string;
  labelRight?: ReactNode;
  prefix?: string;
  rightAccessory?: ReactNode;
  error?: string;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, labelRight, prefix, rightAccessory, error, ...inputProps },
  ref
) {
  const borderClass = error ? 'border-dangerFg' : 'border-borderStrong';

  return (
    <View className="gap-1.5">
      <View className="flex-row items-center justify-between">
        <Text font="bold" className="text-base">
          {label}
        </Text>
        {labelRight}
      </View>
      <View className="flex-row gap-2">
        {prefix ? (
          <View
            className={`h-14 justify-center rounded-input border-2 bg-primarySoft px-3.5 ${borderClass}`}
          >
            <Text font="bold" className="text-lg">
              {prefix}
            </Text>
          </View>
        ) : null}
        <View
          className={`h-14 flex-1 flex-row items-center rounded-input border-2 bg-surface ${borderClass}`}
        >
          <TextInput
            ref={ref}
            accessibilityLabel={label}
            placeholderTextColor={colors.placeholder}
            className="h-full flex-1 px-4 font-body text-lg text-text"
            {...inputProps}
          />
          {rightAccessory ? <View className="pr-2">{rightAccessory}</View> : null}
        </View>
      </View>
      {error ? (
        <Text font="semibold" className="text-[15px] text-dangerFg">
          {error}
        </Text>
      ) : null}
    </View>
  );
});
