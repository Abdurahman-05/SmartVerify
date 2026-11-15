import { forwardRef, type ComponentType, type ReactNode } from 'react';
import { TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';

import { useBrandColors } from '@/store/theme';
import { colors } from '@/theme/tokens';

import { Text } from './Text';

interface InputProps extends TextInputProps {
  label: string;
  labelRight?: ReactNode;
  prefix?: string;
  rightAccessory?: ReactNode;
  error?: string;
  /** Small brand-coloured icon before the label. */
  labelIcon?: ComponentType<{ size?: number; color?: string }>;
  /** Label icon colour; defaults to the theme colour. */
  labelIconColor?: string;
  /** Sign in design `.fld`: 52 px pill, near-white, thin dark hairline. */
  round?: boolean;
}

const glassShadow = { boxShadow: 'inset 0 1px 0 #FFFFFF, 0 10px 26px rgba(30,20,25,0.08)' };
const roundShadow = { boxShadow: 'inset 0 1px 2px rgba(30,26,28,0.04)' };

/** Light glass field (design `.fl` label + `.g.fld`): 14 px bold label, 54 px glass box, radius 16. */
export const Input = forwardRef<TextInputInstance, InputProps>(function Input(
  {
    label,
    labelRight,
    prefix,
    rightAccessory,
    error,
    labelIcon: LabelIcon,
    labelIconColor,
    round = false,
    ...inputProps
  },
  ref
) {
  const brand = useBrandColors();
  const borderClass = error
    ? 'border-2 border-dangerFg'
    : round
      ? 'border border-[#1E1A1C]/[0.08]'
      : 'border border-white';

  return (
    <View className={round ? 'gap-2' : 'gap-1.5'}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          {LabelIcon ? <LabelIcon size={18} color={labelIconColor ?? brand.primary} /> : null}
          <Text font="bold" className="text-sm">
            {label}
          </Text>
        </View>
        {labelRight}
      </View>
      <View
        className={`flex-row items-center ${round ? 'h-[52px] rounded-full bg-white/85' : 'h-[54px] rounded-input bg-white/60'} ${borderClass}`}
        style={round ? roundShadow : glassShadow}
      >
        {prefix ? (
          // Design: the country code sits inside the field, with a thin divider.
          <View className={`flex-row items-center gap-2.5 ${round ? 'pl-[18px]' : 'pl-3.5'}`}>
            <Text font="bold" tone={round ? undefined : 'muted'} className="text-[17px]">
              {prefix}
            </Text>
            <View
              className={round ? 'h-[22px] w-px bg-black/[0.15]' : 'h-6 w-px bg-black/[0.12]'}
            />
          </View>
        ) : null}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.placeholder}
          className={`h-full flex-1 font-body text-[17px] text-text ${prefix ? 'px-2.5' : round ? 'px-[18px]' : 'px-3.5'}`}
          {...inputProps}
        />
        {rightAccessory ? <View className={round ? 'pr-2' : 'pr-1'}>{rightAccessory}</View> : null}
      </View>
      {error ? (
        <Text font="semibold" className="text-[15px] text-dangerFg">
          {error}
        </Text>
      ) : null}
    </View>
  );
});
