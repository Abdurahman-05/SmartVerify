import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import am from './am.json';
import en from './en.json';

export type Language = 'en' | 'am';

/** The language picked in Profile, kept on the phone so the app opens in it next time. */
const LANGUAGE_KEY = 'smartverify.language';

/** Read before the first screen (the start-up loading page too): no async wait. */
function savedLanguage(): Language | null {
  if (Platform.OS === 'web') return null;
  try {
    const value = SecureStore.getItem(LANGUAGE_KEY);
    return value === 'am' || value === 'en' ? value : null;
  } catch {
    return null;
  }
}

const deviceLanguage: Language = getLocales()[0]?.languageCode === 'am' ? 'am' : 'en';

i18n.use(initReactI18next).init({
  lng: savedLanguage() ?? deviceLanguage,
  fallbackLng: 'en',
  resources: { en: { translation: en }, am: { translation: am } },
  interpolation: { escapeValue: false },
});

export const setLanguage = (lang: Language) => {
  if (Platform.OS !== 'web') {
    try {
      SecureStore.setItem(LANGUAGE_KEY, lang);
    } catch {
      // Not saved: the app still switches now, and opens in the phone's language next time.
    }
  }
  return i18n.changeLanguage(lang);
};

export default i18n;
