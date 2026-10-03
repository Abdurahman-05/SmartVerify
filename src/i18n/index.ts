import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import en from './en.json';
import am from './am.json';

const languageDetectorPlugin = {
  type: 'languageDetector' as const,
  async: true,
  init: () => {},
  detect: (callback: (lang: string) => void) => {
    const locale = Localization.getLocales()[0]?.languageCode ?? 'en';
    callback(locale === 'am' ? 'am' : 'en');
  },
};

i18n
  .use(languageDetectorPlugin as any)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    resources: { en: { translation: en }, am: { translation: am } },
    interpolation: { escapeValue: false },
  } as any);

export default i18n;
export const changeLanguage = (lang: 'en' | 'am') => i18n.changeLanguage(lang);
export const getCurrentLanguage = () => i18n.language as 'en' | 'am';
