import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, View } from 'react-native';

import { colors } from '@/theme/tokens';

import { GlassCard } from './GlassCard';
import { alpha, useGlass } from './glassTokens';
import { Text } from './Text';

export interface SegmentedProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** Glass pill of equal choices; the chosen one is a theme gradient with white text. */
export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  const g = useGlass();
  return (
    <GlassCard radius={24} style={{ padding: 4, flexDirection: 'row', gap: 4 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className="h-11 flex-1 justify-center active:opacity-80"
          >
            <View
              className="h-10 items-center justify-center overflow-hidden rounded-[20px] px-2"
              style={active ? { boxShadow: `0 6px 14px ${alpha(g.primary, 0.3)}` } : null}
            >
              {active ? (
                <LinearGradient
                  colors={[g.primary2, g.primary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
                />
              ) : null}
              <Text
                font="bold"
                className="text-sm"
                style={{ color: active ? '#FFFFFF' : colors.text }}
                numberOfLines={1}
              >
                {o.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </GlassCard>
  );
}
