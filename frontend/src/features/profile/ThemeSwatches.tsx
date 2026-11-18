import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/store/theme';
import { THEME_IDS, themes } from '@/theme/themes';
import { colors } from '@/theme/tokens';
import { GlassCard } from '@/ui/glass';

const SWATCH = 28;

export function ThemeSwatches() {
  const { t } = useTranslation();
  const themeId = useTheme((s) => s.themeId);
  const setTheme = useTheme((s) => s.setTheme);

  return (
    <GlassCard className="mx-4 mt-3 px-4 py-3">
      <View className="flex-row items-center justify-between">
        <Text font="bold" className="text-[15px]">
          {t('profile.theme')}
        </Text>
        <Text tone="muted" className="text-sm">
          {t(`themes.${themeId}`)}
        </Text>
      </View>
      <View className="mt-2.5 flex-row justify-between" accessibilityRole="radiogroup">
        {THEME_IDS.map((id) => {
          const selected = id === themeId;
          const name = t(`themes.${id}`);
          return (
            <Pressable
              key={id}
              onPress={() => setTheme(id)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={t('profile.themeOption', { name })}
              hitSlop={6}
              className="h-11 w-10 items-center justify-center"
            >
              <View
                className="h-9 w-9 items-center justify-center rounded-full border-2"
                style={{ borderColor: selected ? themes[id].primary : 'transparent' }}
              >
                <View
                  className="items-center justify-center rounded-full"
                  style={{ width: SWATCH, height: SWATCH, backgroundColor: themes[id].primary }}
                >
                  {selected ? <Check size={16} color={colors.surface} strokeWidth={3} /> : null}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </GlassCard>
  );
}
