import { View } from 'react-native';

import { Text } from './Text';

export function BankBadge({ code, size = 48 }: { code: string; size?: 40 | 44 | 48 }) {
  return (
    <View
      className="items-center justify-center rounded-[14px] bg-successBg"
      style={{ width: size, height: size }}
    >
      <Text font="bold" className="text-sm text-primary">
        {code}
      </Text>
    </View>
  );
}
