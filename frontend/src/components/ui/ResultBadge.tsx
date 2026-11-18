import { LinearGradient } from 'expo-linear-gradient';
import { Check } from 'lucide-react-native';
import { View } from 'react-native';

import { Text } from './Text';

/**
 * Light glass result mark: a soft ring with a gradient circle inside (green tick for success,
 * red "!" for a problem), as in the "Result verified / not matching" designs.
 */
export function ResultBadge({ success }: { success: boolean }) {
  const ring = success ? 'rgba(14,122,78,0.14)' : 'rgba(179,38,30,0.12)';
  const fill = success ? (['#2BC489', '#0E7A4E'] as const) : (['#E5544B', '#B3261E'] as const);
  const glow = success ? 'rgba(14,122,78,0.35)' : 'rgba(179,38,30,0.3)';
  return (
    <View
      className="h-24 w-24 items-center justify-center rounded-full"
      style={{ backgroundColor: ring }}
    >
      <View
        className="h-[74px] w-[74px] overflow-hidden rounded-full"
        style={{ boxShadow: `inset 0 2px 0 rgba(255,255,255,0.4), 0 12px 24px ${glow}` }}
      >
        <LinearGradient
          colors={fill}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          {success ? (
            <Check size={38} color="#FFFFFF" strokeWidth={3} />
          ) : (
            <Text
              font="heading"
              className="text-[38px] leading-[44px]"
              style={{ color: '#FFFFFF' }}
            >
              !
            </Text>
          )}
        </LinearGradient>
      </View>
    </View>
  );
}
