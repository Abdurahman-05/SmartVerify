import type { BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useBrandColors } from '@/store/theme';
import { colors } from '@/theme/tokens';

import { GlassCard } from './GlassCard';
import { glass } from './glassColors';

const BUTTON = 52;

/**
 * Floating glass pill tab bar (README "Bottom nav"): round 52 px buttons, the active one a filled
 * brand circle with a white icon. Tabs, order, badges and press behaviour come from the navigator.
 */
export function GlassNav({
  state,
  descriptors,
  emitter,
  navigateToTab,
  insets,
}: BottomTabBarProps) {
  const brand = useBrandColors();
  const routes = state.routes.filter(
    (route) => !(descriptors[route.key]?.options as { hidden?: boolean } | undefined)?.hidden
  );

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: Math.max(insets.bottom, 0) + 16 }]}
    >
      <GlassCard radius={40} blur style={styles.pill}>
        {routes.map((route) => {
          const focused = state.routes[state.index]?.key === route.key;
          const { options } = descriptors[route.key];
          const color = focused ? '#FFFFFF' : glass.text;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const onPress = () => {
            const event = emitter.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          const onLongPress = () => emitter.emit({ type: 'tabLongPress', target: route.key });
          const badge = options.tabBarBadge;
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              style={[
                styles.button,
                focused ? [styles.on, { backgroundColor: brand.primary }] : null,
              ]}
            >
              {options.tabBarIcon?.({ focused, color, size: 24 })}
              {badge !== undefined && badge !== null && badge !== '' ? (
                <View style={styles.badge}>
                  <Text
                    font="bold"
                    className="text-[12px] leading-[14px]"
                    style={{ color: '#FFFFFF' }}
                  >
                    {String(badge)}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: { flexDirection: 'row', gap: 10, padding: 8 },
  button: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  on: { boxShadow: '0 8px 18px rgba(30,20,25,0.25)' },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.alert,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
