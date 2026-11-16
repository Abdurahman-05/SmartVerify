import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AuthBackground } from '@/components/ui/AuthBackground';
import { FormScreen } from '@/components/ui/FormScreen';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { formatMoney } from '@/components/ui/MoneyText';
import { Text } from '@/components/ui/Text';
import { AuthCard, AuthLogo, AuthSubtitle, AuthTitle, SecureLine } from '@/features/auth/AuthParts';
import { useTheme } from '@/store/theme';
import { DEFAULT_THEME, THEME_IDS, themes, themeVars, type ThemeId } from '@/theme/themes';
import { PrimaryButton } from '@/ui/glass';

/** Sample amount in the preview strip, so the pick can be seen on a real-looking number. */
const PREVIEW_ETB = 18200;
const ROWS = [THEME_IDS.slice(0, 4), THEME_IDS.slice(4)];

/**
 * First start only: pick the app's colours (like a new editor install asks for its theme).
 * The choice is saved on the phone and can be changed later in Profile. Same look as Create
 * account (assets/images/theme and subscription/theme-screen.png); shown before any screen, so
 * there is nothing to go back to.
 */
export function FirstThemeScreen() {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<ThemeId>(DEFAULT_THEME);
  const setTheme = useTheme((s) => s.setTheme);
  const brand = themes[picked];

  return (
    <AuthBackground>
      <FormScreen plain>
        <View className="absolute right-5 top-4 z-10">
          <LanguageToggle />
        </View>
        <View
          className="flex-1 items-center pb-6"
          style={[{ paddingTop: 56, paddingHorizontal: 22 }, themeVars(picked)]}
        >
          <AuthLogo />
          <AuthTitle text={t('firstTheme.chooseTitle')} accent={brand.primaryDeep} />
          {/* Step 2 of 3 in the start flow: account, colour, plan. */}
          <AuthSubtitle
            text={`${t('auth.step', { current: 2, total: 3 })} · ${t('firstTheme.changeLater')}`}
          />
          <View className="mt-2.5 w-32 flex-row gap-1.5">
            {[1, 2, 3].map((n) => (
              <View
                key={n}
                className={`h-1.5 flex-1 rounded-[3px] ${n <= 2 ? '' : 'bg-black/10'}`}
                style={n <= 2 ? { backgroundColor: brand.primaryDeep } : null}
              />
            ))}
          </View>

          <AuthCard>
            <View className="gap-2" accessibilityRole="radiogroup">
              {ROWS.map((row) => (
                <View key={row[0]} className="flex-row gap-2">
                  {row.map((id) => {
                    const selected = id === picked;
                    const color = themes[id].primaryDeep;
                    const name = t(`themes.${id}`);
                    return (
                      <Pressable
                        key={id}
                        onPress={() => setPicked(id)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={t('profile.themeOption', { name })}
                        className="h-20 flex-1 items-center justify-center gap-1.5 rounded-[18px] active:opacity-80"
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.8)',
                          borderWidth: selected ? 2 : 1.5,
                          borderColor: selected ? color : 'rgba(30,26,28,0.08)',
                        }}
                      >
                        <View
                          className="h-[34px] w-[34px] items-center justify-center rounded-full"
                          style={{ backgroundColor: color }}
                        >
                          {selected ? <Check size={18} color="#FFFFFF" strokeWidth={3} /> : null}
                        </View>
                        <Text
                          font="bold"
                          className="text-[13px]"
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.8}
                        >
                          {name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>

            <View className="overflow-hidden rounded-[18px] px-3.5 py-3">
              <View
                style={[
                  { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
                  { backgroundColor: brand.primaryDeep },
                ]}
              />
              <Text
                font="bold"
                className="text-xs uppercase"
                style={{ color: 'rgba(255,255,255,0.9)' }}
              >
                {t('home.today')}
              </Text>
              <Text font="heading" className="text-2xl leading-8" style={{ color: '#FFFFFF' }}>
                {formatMoney(PREVIEW_ETB)}
              </Text>
            </View>

            <PrimaryButton
              accent
              gradient={[brand.primaryDeep, brand.primaryDeep]}
              label={t('firstTheme.useColor')}
              onPress={() => setTheme(picked)}
            />
          </AuthCard>

          <SecureLine text={t('brand.secure')} style={{ marginTop: 22 }} />
        </View>
      </FormScreen>
    </AuthBackground>
  );
}
