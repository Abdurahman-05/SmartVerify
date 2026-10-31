import Constants from 'expo-constants';

/**
 * Which app this is: the Shop app (apps/shop: shops, pharmacies, …) or the Restaurant app
 * (apps/restaurant). Each app's app.json sets extra.appVariant.
 */
export const appVariant: 'normal' | 'restaurant' =
  (Constants.expoConfig?.extra as { appVariant?: string } | undefined)?.appVariant === 'normal'
    ? 'normal'
    : 'restaurant';

export const isNormalApp = appVariant === 'normal';
