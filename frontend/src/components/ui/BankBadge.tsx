import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from './Text';

/** Logos for the banks we have them for; the others show their code. */
const LOGOS: Record<string, number> = {
  CBE: require('../../../assets/images/banks/cbe.jpg') as number,
  TEL: require('../../../assets/images/banks/telebirr.webp') as number,
  DAS: require('../../../assets/images/banks/dashen.png') as number,
  BOA: require('../../../assets/images/banks/boa.jpg') as number,
  MPE: require('../../../assets/images/banks/m-pesa.png') as number,
  EBR: require('../../../assets/images/banks/ebirr.jpg') as number,
};

export function BankBadge({ code, size = 48 }: { code: string; size?: 40 | 44 | 48 | 64 }) {
  const logo = LOGOS[code];
  return (
    <View
      // White behind logos so ones that do not fill the square (M-PESA, eBirr) match the others.
      className={`items-center justify-center overflow-hidden rounded-[14px] ${logo ? 'bg-white' : 'bg-primaryTile'}`}
      style={{ width: size, height: size }}
    >
      {logo ? (
        <Image
          source={logo}
          contentFit="contain"
          style={{ width: size, height: size }}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text font="bold" className={`text-primary ${size >= 64 ? 'text-base' : 'text-sm'}`}>
          {code}
        </Text>
      )}
    </View>
  );
}
