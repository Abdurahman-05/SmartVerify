/** Which app this is: the Normal app (shops, pharmacies, …) or the Restaurant app. */
export const appVariant: 'normal' | 'restaurant' =
  process.env.EXPO_PUBLIC_APP_VARIANT === 'normal' ? 'normal' : 'restaurant';

export const isNormalApp = appVariant === 'normal';
