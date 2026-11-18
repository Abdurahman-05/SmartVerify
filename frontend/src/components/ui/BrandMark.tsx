import { View } from 'react-native';

import { GebtualLogo } from './GebtualLogo';

interface BrandMarkProps {
  size?: number;
}

/** The Gebtual logo in the theme colours, no tile. `size` is the logo height-ish box. */
export function BrandMark({ size = 44 }: BrandMarkProps) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <GebtualLogo width={Math.round(size * 1.4)} variant="theme" />
    </View>
  );
}
