import { Check, X } from 'lucide-react-native';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors } from '@/theme/tokens';

/** Large check / cross with soft rings, from the payment result designs. */
export function ResultBadge({ success }: { success: boolean }) {
  const tint = success ? colors.success : colors.alert;
  const Icon = success ? Check : X;
  return (
    <View className="h-[200px] w-[200px] items-center justify-center">
      <Svg width={200} height={200} viewBox="0 0 200 200" style={{ position: 'absolute' }}>
        <Circle cx={100} cy={100} r={98} fill="none" stroke={tint} strokeWidth={1.5} opacity={0.18} />
        <Circle cx={100} cy={100} r={76} fill="none" stroke={tint} strokeWidth={1.5} opacity={0.32} />
        <Circle cx={100} cy={100} r={56} fill={tint} opacity={0.14} />
      </Svg>
      <View
        className="h-[84px] w-[84px] items-center justify-center rounded-full"
        style={{ backgroundColor: tint }}
      >
        <Icon size={40} color={colors.surface} strokeWidth={2.6} />
      </View>
    </View>
  );
}
