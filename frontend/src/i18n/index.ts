import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import am from './am.json';
import en from './en.json';

export type Language = 'en' | 'am';

const deviceLanguage: Language = getLocales()[0]?.languageCode === 'am' ? 'am' : 'en';

i18n.use(initReactI18next).init({
  lng: deviceLanguage,
  fallbackLng: 'en',
  resources: { en: { translation: en }, am: { translation: am } },
  interpolation: { escapeValue: false },
});

export const setLanguage = (lang: Language) => i18n.changeLanguage(lang);

export default i18n;
