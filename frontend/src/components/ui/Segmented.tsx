import type { ComponentType } from 'react';
import { Pressable, View } from 'react-native';

import { colors } from '@/theme/tokens';

import { GlassCard } from './GlassCard';
import { alpha, useGlass } from './glassTokens';
import { Text } from './Text';

export interface SegmentedProps<T extends string> {
  options: readonly {
    value: T;
    label: string;
    icon?: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  }[];
  value: T;
  onChange: (value: T) => void;
}

/** Glass pill of equal choices (optionally with icons); the chosen one is flat deep theme colour. */
export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  const g = useGlass();
  return (
    <GlassCard radius={24} style={{ padding: 4, flexDirection: 'row', gap: 4 }}>
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        const fg = active ? '#FFFFFF' : colors.text;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className="h-11 flex-1 justify-center active:opacity-80"
          >
            <View
              className="h-10 flex-row items-center justify-center gap-1.5 overflow-hidden rounded-[20px] px-2"
              style={active ? { boxShadow: `0 6px 14px ${alpha(g.primary, 0.3)}` } : null}
            >
              {active ? (
                <View
                  style={[
                    { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
                    { backgroundColor: g.primaryDeep },
                  ]}
                />
              ) : null}
              {Icon ? <Icon size={17} color={fg} strokeWidth={2.2} /> : null}
              <Text
                font="bold"
                className="shrink text-sm"
                style={{ color: fg }}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
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
