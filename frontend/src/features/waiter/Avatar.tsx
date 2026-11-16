import { View } from 'react-native';

import { useGlass } from '@/components/ui/glassTokens';
import { Text } from '@/components/ui/Text';

/** Round deep-theme avatar with the first letter of a name. */
export function Avatar({ name }: { name: string }) {
  const g = useGlass();
  return (
    <View
      className="h-14 w-14 items-center justify-center rounded-full"
      style={{ backgroundColor: g.primaryDeep }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text font="heading" tone="inverse" className="text-xl">
        {name.trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}
