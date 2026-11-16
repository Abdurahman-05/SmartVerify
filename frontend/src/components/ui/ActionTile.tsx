import { Lock } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/theme/tokens';

import { IconTile } from './IconTile';
import { Text } from './Text';

const BADGE = '#FACC15';

export interface ActionTileProps {
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  title: string;
  sub?: string;
  /** Small count shown on the icon (hidden when empty or 0). */
  badge?: number | string;
  /** Small lock before the sub line (owner-only tiles). */
  locked?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Home grid tile: gradient icon box, title and one sub line. Two per row inside one GlassCard. */
export function ActionTile({ icon, title, sub, badge, locked, onPress, style }: ActionTileProps) {
  const showBadge = badge !== undefined && badge !== 0 && badge !== '';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={sub ? `${title}, ${sub}` : title}
      className="min-h-[68px] flex-1 flex-row items-center gap-2.5 rounded-[18px] p-2.5 active:opacity-80"
      style={[
        {
          backgroundColor: 'rgba(255,255,255,0.45)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.9)',
        },
        style,
      ]}
    >
      <View>
        <IconTile icon={icon} size={48} radius={16} iconSize={24} />
        {showBadge ? (
          <View
            className="absolute -right-1.5 -top-1.5 h-5 min-w-5 items-center justify-center rounded-full px-1"
            style={{ backgroundColor: BADGE }}
          >
            <Text font="bold" className="text-[11px]" style={{ color: colors.text }}>
              {badge}
            </Text>
          </View>
        ) : null}
      </View>
      <View className="flex-1">
        <Text font="bold" className="text-sm" numberOfLines={1}>
          {title}
        </Text>
        {sub ? (
          <View className="flex-row items-center gap-1">
            {locked ? <Lock size={12} color={colors.muted} strokeWidth={2.4} /> : null}
            <Text className="flex-1 text-xs" style={{ color: colors.muted }} numberOfLines={1}>
              {sub}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
