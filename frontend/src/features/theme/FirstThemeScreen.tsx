import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/store/theme';
import { DEFAULT_THEME, THEME_IDS, themes, themeVars, type ThemeId } from '@/theme/themes';
import { colors } from '@/theme/tokens';

/** A small picture of the app in one theme: header bar, a card and a button. */
function Preview({ id }: { id: ThemeId }) {
  const c = themes[id];
  return (
    <View className="overflow-hidden rounded-[14px] border border-border bg-background">
      <View className="h-6" style={{ backgroundColor: c.primary }} />
      <View className="gap-1.5 p-2">
        <View className="h-2 w-3/4 rounded-full" style={{ backgroundColor: c.primaryTile }} />
        <View className="h-2 w-1/2 rounded-full" style={{ backgroundColor: c.primaryTint }} />
        <View className="mt-1 h-5 rounded-[6px]" style={{ backgroundColor: c.primary }} />
      </View>
    </View>
  );
}

/**
 * First start only: pick the app's colours (like a new editor install asks for its theme).
 * The choice is saved on the phone and can be changed later in Profile.
 */
export function FirstThemeScreen() {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<ThemeId>(DEFAULT_THEME);
  const setTheme = useTheme((s) => s.setTheme);
  const brand = themes[picked];

  return (
    <SafeAreaView className="flex-1 bg-background" style={themeVars(picked)}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 12 }}>
        <Text font="heading" className="text-[26px]" accessibilityRole="header">
          {t('firstTheme.title')}
        </Text>
        <Text tone="muted" className="mt-1.5 text-base">
          {t('firstTheme.subtitle')}
        </Text>

        <View
          className="mt-5 flex-row flex-wrap justify-between gap-y-3"
          accessibilityRole="radiogroup"
        >
          {THEME_IDS.map((id) => {
            const selected = id === picked;
            const name = t(`themes.${id}`);
            return (
              <Pressable
                key={id}
                onPress={() => setPicked(id)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={t('profile.themeOption', { name })}
                className="w-[48%] rounded-[18px] border-[2.5px] bg-surface p-2.5"
                style={{ borderColor: selected ? themes[id].primary : colors.border }}
              >
                <Preview id={id} />
                <View className="mt-2 min-h-7 flex-row items-center justify-between">
                  <Text font={selected ? 'bold' : 'semibold'} className="text-base">
                    {name}
                    {id === DEFAULT_THEME ? ` · ${t('firstTheme.default')}` : ''}
                  </Text>
                  {selected ? (
                    <View
                      className="h-7 w-7 items-center justify-center rounded-full"
                      style={{ backgroundColor: themes[id].primary }}
                    >
                      <Check size={16} color={colors.surface} strokeWidth={3} />
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text tone="muted" className="mt-4 text-sm">
          {t('firstTheme.later')}
        </Text>
      </ScrollView>

      <View className="px-5 pb-4 pt-2">
        <Pressable
          onPress={() => setTheme(picked)}
          accessibilityRole="button"
          className="h-14 items-center justify-center rounded-button active:opacity-90"
          style={{ backgroundColor: brand.primary }}
        >
          <Text font="bold" tone="inverse" className="text-[17px]">
            {t('firstTheme.continue')}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
