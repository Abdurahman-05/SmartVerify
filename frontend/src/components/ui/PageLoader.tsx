import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { LogoLoader } from './LogoLoader';

/**
 * Loading over the current screen: a blurred, lightly tinted veil with the animated Gebtual
 * logo and "Loading…". Renders nothing while `visible` is false.
 */
export function PageLoader({ visible, label }: { visible: boolean; label?: string }) {
  const { t } = useTranslation();
  if (!visible) return null;
  const text = label ?? t('loading.label');
  return (
    <View
      style={StyleSheet.absoluteFill}
      accessibilityRole="progressbar"
      accessibilityLabel={text}
      accessibilityViewIsModal
    >
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,248,242,0.45)' }]} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <LogoLoader label={text} />
      </View>
    </View>
  );
}
