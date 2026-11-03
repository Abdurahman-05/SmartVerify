import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable } from 'react-native';

import { colors } from '@/theme/tokens';

type TabOptions = Extract<
  NonNullable<ComponentProps<typeof Tabs>['screenOptions']>,
  { tabBarButton?: unknown }
>;
type TabButtonProps = Parameters<NonNullable<TabOptions['tabBarButton']>>[0];

/**
 * A tab in the bottom bar. Android's tap ripple stays inside the tab instead of the default
 * circle that spreads over the screen above and Android's own buttons below.
 */
export function TabButton({ ref: _ref, ...props }: TabButtonProps) {
  return <Pressable {...props} android_ripple={{ borderless: false, color: colors.border }} />;
}
