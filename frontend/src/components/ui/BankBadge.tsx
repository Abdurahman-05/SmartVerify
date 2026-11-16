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

/** Bank logo: the deep theme colour with white initials (the same look for every bank). */
export function BankBadge({ code, size = 48 }: { code: string; size?: 40 | 44 | 48 | 64 }) {
  const g = useGlass();
  const label = INITIALS[code] ?? code;
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
