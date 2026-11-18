import { useEffect } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToast } from '@/store/toast';
import { colors } from '@/theme/tokens';

import { Text } from './Text';

/** How long a toast stays. */
const TOAST_MS = 3000;

/** One short message at the top of the screen; hides by itself. Mounted once in the root layout. */
export function Toast() {
  const insets = useSafeAreaInsets();
  const message = useToast((s) => s.message);
  const id = useToast((s) => s.id);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => useToast.getState().hide(), TOAST_MS);
    return () => clearTimeout(timer);
  }, [message, id]);

  if (!message) return null;
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: insets.top + 6, left: 16, right: 16 }}
      className="items-center"
      accessibilityLiveRegion="assertive"
    >
      <View className="rounded-[16px] bg-dangerBg px-4 py-3">
        <Text
          font="semibold"
          className="text-center text-[15px]"
          style={{ color: colors.dangerFg }}
        >
          {message}
        </Text>
      </View>
    </View>
  );
}
