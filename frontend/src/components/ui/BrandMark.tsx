import { Image } from 'expo-image';
import { View } from 'react-native';

const mark = require('../../../assets/images/logo-mark.png') as number;

interface BrandMarkProps {
  size?: number;
}

/** The ገ logo with its yellow check, on a tile in the chosen theme colour. */
export function BrandMark({ size = 44 }: BrandMarkProps) {
  return (
    <View
      className="overflow-hidden bg-primary"
      style={{ width: size, height: size, borderRadius: size * 0.3 }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Image source={mark} style={{ width: size, height: size }} contentFit="cover" />
    </View>
  );
}
