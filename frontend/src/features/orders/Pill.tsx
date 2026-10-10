import { Pressable } from 'react-native';

import { Text } from '@/components/ui/Text';

interface PillProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  role?: 'radio' | 'checkbox';
  dark?: boolean;
}

/** Rounded choice chip used for categories, kitchen notes, and table areas. */
export function Pill({ label, selected, onPress, role = 'radio', dark = false }: PillProps) {
  const selectedBg = dark ? 'bg-text' : 'bg-primary';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={role}
      accessibilityState={role === 'radio' ? { selected } : { checked: selected }}
      className={`h-[46px] justify-center rounded-[23px] px-[18px] ${
        selected ? selectedBg : 'border-2 border-borderStrong bg-surface active:bg-background'
      }`}
    >
      <Text font="bold" tone={selected ? 'inverse' : 'default'} className="text-base">
        {label}
      </Text>
    </Pressable>
  );
}
