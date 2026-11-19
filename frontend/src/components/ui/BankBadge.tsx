import { Image } from 'expo-image';
import { View } from 'react-native';

import { useGlass } from './glassTokens';
import { Text } from './Text';

/** Short initials per bank code; unknown banks show their code. */
const INITIALS: Record<string, string> = {
  CBE: 'CBE',
  TEL: 'TB',
  DAS: 'DB',
  BOA: 'BoA',
  MPE: 'MP',
  EBR: 'eB',
  CBB: 'CB',
  AWA: 'AB',
  ABY: 'BoA',
  WEG: 'WB',
  NIB: 'NIB',
  COP: 'CoE',
  ZEM: 'ZB',
};

/** Real logos of the banks we have one for (assets/images/banks). */
const LOGOS: Record<string, number> = {
  CBE: require('../../../assets/images/banks/cbe.jpg') as number,
  CBB: require('../../../assets/images/banks/cbe-birr.jpg') as number,
  TEL: require('../../../assets/images/banks/telebirr.webp') as number,
  DAS: require('../../../assets/images/banks/dashen.png') as number,
  BOA: require('../../../assets/images/banks/boa.jpg') as number,
  EBR: require('../../../assets/images/banks/ebirr.jpg') as number,
  MPE: require('../../../assets/images/banks/m-pesa.png') as number,
  AWA: require('../../../assets/images/banks/awash.png') as number,
};

/** Bank logo; banks without a logo get the deep theme colour with white initials. */
export function BankBadge({ code, size = 48 }: { code: string; size?: 40 | 44 | 48 | 64 }) {
  const g = useGlass();
  const label = INITIALS[code] ?? code;
  const logo = LOGOS[code];
  if (logo) {
    return (
      <View
        className="items-center justify-center overflow-hidden rounded-[14px] bg-white"
        style={{ width: size, height: size }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Image source={logo} style={{ width: size, height: size }} contentFit="contain" />
      </View>
    );
  }
  return (
    <View
      className="items-center justify-center rounded-[14px]"
      style={{ width: size, height: size, backgroundColor: g.primaryDeep }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text
        font="bold"
        tone="inverse"
        className={size >= 64 ? 'text-lg' : label.length > 3 ? 'text-xs' : 'text-sm'}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {label}
      </Text>
    </View>
  );
}
