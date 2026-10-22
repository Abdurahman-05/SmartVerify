import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import am from './am.json';
import en from './en.json';

export type Language = 'en' | 'am';

/** The browser's language: Amharic if it asks for it, English otherwise. */
const browserLanguage: Language =
  typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('am')
    ? 'am'
    : 'en';

void i18n.use(initReactI18next).init({
  lng: browserLanguage,
  fallbackLng: 'en',
  resources: { en: { translation: en }, am: { translation: am } },
  interpolation: { escapeValue: false },
});

export const setLanguage = (lang: Language) => i18n.changeLanguage(lang);

export default i18n;
