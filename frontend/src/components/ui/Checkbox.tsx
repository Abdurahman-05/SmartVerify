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
      className="min-h-11 flex-row items-center gap-3"
    >
      <View
        className={`h-[26px] w-[26px] items-center justify-center rounded-md border-2 ${
          checked ? 'border-primary bg-primary' : 'border-borderStrong bg-surface'
        }`}
      >
        {checked ? <Check size={18} color={colors.surface} strokeWidth={3} /> : null}
      </View>
      <View className="flex-1 flex-row flex-wrap">{children}</View>
    </Pressable>
  );
}
