import { Pressable } from 'react-native';

import { Text } from '@/components/ui/Text';

import { GlassCard } from './GlassCard';

interface SegmentProps<T extends string> {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}

/**
 * The design's `.g.seg`: a glass bar (radius 16, 4 px padding) with equal 46 px buttons; the
 * chosen one is filled with the brand color and white text.
 */
export function Segment<T extends string>({ options, value, onChange }: SegmentProps<T>) {
  return (
    <GlassCard radius={16} className="flex-row gap-1 p-1" accessibilityRole="radiogroup">
      {options.map(({ key, label }) => {
        const selected = key === value;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            className={`h-[46px] flex-1 items-center justify-center rounded-[12px] px-2 ${
              selected ? 'bg-primary' : 'active:bg-white/60'
            }`}
          >
            <Text
              font="bold"
              tone={selected ? 'inverse' : 'default'}
              className="text-[15px]"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </GlassCard>
  );
}
