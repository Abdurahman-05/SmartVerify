import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { setLanguage, type Language } from '@/i18n';

import { Text } from './Text';

const options: { value: Language; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'am', label: 'አማ' },
];

export function LanguageToggle() {
  const { i18n } = useTranslation();

  return (
    <View className="flex-row overflow-hidden rounded-[22px] border-2 border-borderStrong bg-surface">
      {options.map(({ value, label }) => {
        const active = i18n.language === value;
        return (
          <Pressable
            key={value}
            onPress={() => setLanguage(value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className={`h-10 min-w-11 items-center justify-center px-3.5 ${active ? 'bg-primary' : 'bg-surface'}`}
          >
            <Text font="bold" tone={active ? 'inverse' : 'default'} className="text-[15px]">
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
