import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/store/theme';
import { THEME_IDS, themes } from '@/theme/themes';
import { colors } from '@/theme/tokens';

const SWATCH = 44;

export function ThemeSwatches() {
  const { t } = useTranslation();
  const themeId = useTheme((s) => s.themeId);
  const setTheme = useTheme((s) => s.setTheme);

  return (
    <View className="mx-4 mt-3 rounded-card border-[1.5px] border-border bg-surface py-3">
      <Text font="bold" className="px-3.5 pb-2.5 text-[17px]">
        {t('profile.theme')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingHorizontal: 14 }}
        accessibilityRole="radiogroup"
      >
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
              className="items-center gap-1"
            >
              <View
                className="items-center justify-center rounded-full border-[3px] p-0.5"
                style={{ borderColor: selected ? themes[id].primary : 'transparent' }}
              >
                <View
                  className="items-center justify-center rounded-full"
                  style={{ width: SWATCH, height: SWATCH, backgroundColor: themes[id].primary }}
                >
                  {selected ? <Check size={22} color={colors.surface} strokeWidth={3} /> : null}
                </View>
              </View>
              <Text font={selected ? 'bold' : 'semibold'} tone={selected ? 'default' : 'muted'} className="text-sm">
                {name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
