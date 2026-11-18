import { Linking } from 'react-native';

import { API_BASE_URL } from '@/lib/api/client';

export type LegalPage = 'terms' | 'privacy';

/** The public pages are served by the backend next to the API (GET /terms, /privacy, + /am). */
const ORIGIN = API_BASE_URL.replace(/\/api\/v1$/, '');

export const legalUrl = (page: LegalPage, language: string) =>
  `${ORIGIN}/${page}${language.startsWith('am') ? '/am' : ''}`;

export const openLegal = (page: LegalPage, language: string) =>
  void Linking.openURL(legalUrl(page, language)).catch(() => {});
