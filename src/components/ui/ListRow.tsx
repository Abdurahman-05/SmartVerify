import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { colors } from '@/theme/tokens';

import { Text } from './Text';

interface ListRowProps {
  icon: LucideIcon;
  label: string;
  onPress?: () => void;
  /** Replaces the chevron, e.g. a switch. */
  right?: ReactNode;
  last?: boolean;
}

export function ListRow({ icon: Icon, label, onPress, right, last }: ListRowProps) {
  const content = (
    <>
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-successBg">
        <Icon size={22} color={colors.primary} strokeWidth={2.2} />
      </View>
      <Text font="bold" className="flex-1 text-[17px]">
        {label}
      </Text>
      {right ?? <ChevronRight size={22} color={colors.muted} strokeWidth={2} />}
    </>
  );
  const className = `min-h-14 flex-row items-center gap-3 px-3.5 py-2 ${last ? '' : 'border-b-[1.5px] border-divider'}`;

  if (!onPress) return <View className={className}>{content}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className={`${className} active:bg-background`}>
      {content}
    </Pressable>
  );
}
