import Svg, { Path } from 'react-native-svg';
import { View } from 'react-native';

import { colors } from '@/theme/tokens';

interface BrandMarkProps {
  size?: number;
}

/** Shield-check logo in a rounded green tile. */
export function BrandMark({ size = 44 }: BrandMarkProps) {
  return (
    <View
      className="items-center justify-center bg-primary"
      style={{ width: size, height: size, borderRadius: size * 0.3 }}
    >
      <Svg
        width={size * 0.57}
        height={size * 0.57}
        viewBox="0 0 24 24"
        fill="none"
        stroke={colors.surface}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
        <Path d="M8.5 12l2.5 2.5 4.5-5" />
      </Svg>
    </View>
  );
}
