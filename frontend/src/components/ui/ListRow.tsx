import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { useBrandColors } from '@/store/theme';

import { Text } from './Text';

interface ListRowProps {
  icon: LucideIcon;
  label: string;
  onPress?: () => void;
  /** Replaces the chevron, e.g. a switch. */
  right?: ReactNode;
  last?: boolean;
}

/** Design `.it` row: 34 px tile icon, 15 px semibold label, hairline divider, 50 px tall. */
export function ListRow({ icon: Icon, label, onPress, right, last }: ListRowProps) {
  const brand = useBrandColors();
  const content = (
    <>
      <View className="h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-primaryTile">
        <Icon size={18} color={brand.primary} strokeWidth={2.2} />
      </View>
      <Text font="semibold" className="flex-1 text-[15px]">
        {label}
      </Text>
      {right ?? <ChevronRight size={18} color="#8A8085" strokeWidth={2.2} />}
    </>
  );
  const className = `min-h-[50px] flex-row items-center gap-3 px-1 py-1.5 ${last ? '' : 'border-b border-black/[0.07]'}`;

  if (!onPress) return <View className={className}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`${className} active:opacity-70`}
    >
      {content}
    </Pressable>
  );
}
