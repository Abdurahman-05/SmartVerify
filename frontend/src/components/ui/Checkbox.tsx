import { Check } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { colors } from '@/theme/tokens';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  accessibilityLabel: string;
  children: ReactNode;
}

export function Checkbox({ checked, onChange, accessibilityLabel, children }: CheckboxProps) {
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      className="min-h-11 flex-row items-center gap-2.5"
    >
      <View
        className={`h-[22px] w-[22px] items-center justify-center rounded-[6px] border-2 ${checked ? 'border-primary bg-primary' : 'border-borderStrong bg-white/70'}`}
      >
        {checked ? <Check size={15} color={colors.surface} strokeWidth={3.2} /> : null}
      </View>
      <View className="flex-1 flex-row flex-wrap">{children}</View>
    </Pressable>
  );
}
