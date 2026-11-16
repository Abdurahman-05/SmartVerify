import { StyleSheet, View, type ViewProps } from 'react-native';

import { useBrandColors } from '@/store/theme';


export interface HeroCardProps extends ViewProps {
  radius?: number;
}

/**
 * The design's `.hero`: 125° brand gradient (28% lighter → primary at 55% → 22% darker),
 * radius 20, deep soft shadow. White text goes on top.
 */
export function HeroCard({ radius = 20, style, children, className, ...props }: HeroCardProps) {
  const brand = useBrandColors();
  return (
    <View className={className} style={[styles.shadow, { borderRadius: radius }, style]} {...props}>
      <View
        pointerEvents="none"
        style={[
          [StyleSheet.absoluteFill, styles.edge, { borderRadius: radius }],
          { backgroundColor: brand.primaryDeep },
        ]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { boxShadow: '0 14px 28px rgba(30,20,25,0.2)' },
  // The design's inner top highlight.
  edge: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.35)' },
});
