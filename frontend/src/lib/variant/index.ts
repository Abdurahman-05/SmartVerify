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

/** Plans sold in each app; a business on the other app's plans must use that app. */
const RESTAURANT_APP_PLANS = ['restaurant', 'restaurant_normal'];
const SHOP_APP_PLANS = ['normal', 'normal_multi'];

/** This business belongs to the other app (no plan yet: either app may start it). */
export const belongsToOtherApp = (plan: string | null | undefined) =>
  !!plan && (isNormalApp ? RESTAURANT_APP_PLANS : SHOP_APP_PLANS).includes(plan);
