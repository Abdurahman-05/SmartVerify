import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Two apps from one code: the Restaurant app (default) and the Normal app for shops,
 * pharmacies, spare parts... Set EXPO_PUBLIC_APP_VARIANT=normal for the Normal app.
 */
const normal = process.env.EXPO_PUBLIC_APP_VARIANT === 'normal';

export default ({ config }: ConfigContext): ExpoConfig => {
  if (!normal) return config as ExpoConfig;
  return {
    ...config,
    name: 'ገብቷል Shop',
    slug: config.slug ?? 'smartVerify',
    scheme: 'smartverify-shop',
    android: {
      ...config.android,
      package: 'com.gebtual.shop',
      adaptiveIcon: { ...config.android?.adaptiveIcon, backgroundColor: '#FFF4E0' },
    },
  };
};
