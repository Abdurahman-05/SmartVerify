import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, View } from 'react-native';

import { LoadingView } from '@/components/ui/LoadingView';
import { Text } from '@/components/ui/Text';
import { type LoadingStyle, loadingStyles, useLoadingStyle } from '@/store/loadingStyle';

const PREVIEW_MS = 2000;

const labelKey: Record<LoadingStyle, string> = {
  brand: 'profile.loadingStyleBrand',
  light: 'profile.loadingStyleLight',
};

/** Trial picker: choose how pages look while loading, with a short preview. */
export function LoadingStylePicker() {
  const { t } = useTranslation();
  const loadingStyle = useLoadingStyle((s) => s.loadingStyle);
  const setLoadingStyle = useLoadingStyle((s) => s.setLoadingStyle);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (!previewing) return;
    const timer = setTimeout(() => setPreviewing(false), PREVIEW_MS);
    return () => clearTimeout(timer);
  }, [previewing]);

  const choose = (style: LoadingStyle) => {
    setLoadingStyle(style);
    setPreviewing(true);
  };

  return (
    <View className="mx-4 mt-3 rounded-card border-[1.5px] border-border bg-surface p-3.5">
      <Text font="bold" className="text-[17px]">
        {t('profile.loadingStyle')}
      </Text>
      <Text tone="muted" className="mt-0.5 text-sm">
        {t('profile.loadingStyleHint')}
      </Text>
      <View className="mt-3 flex-row gap-2" accessibilityRole="radiogroup">
        {loadingStyles.map((style) => {
          const selected = style === loadingStyle;
          return (
            <Pressable
              key={style}
              onPress={() => choose(style)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              className={`min-h-[44px] flex-1 items-center justify-center rounded-input border-[1.5px] px-2 ${
                selected ? 'border-primary bg-primary' : 'border-border bg-background'
              }`}
            >
              <Text
                font={selected ? 'bold' : 'semibold'}
                tone={selected ? 'inverse' : 'default'}
                className="text-sm"
              >
                {t(labelKey[style])}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Modal visible={previewing} animationType="fade" onRequestClose={() => setPreviewing(false)}>
        <Pressable className="flex-1" onPress={() => setPreviewing(false)}>
          <LoadingView screenTitle={t('menuAdmin.title')} />
        </Pressable>
      </Modal>
    </View>
  );
}
