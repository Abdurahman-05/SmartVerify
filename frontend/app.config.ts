import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Two apps from one code: the Restaurant app (default) and the Normal app for shops,
 * pharmacies, spare parts... Set EXPO_PUBLIC_APP_VARIANT=normal for the Normal app.
 */
const normal = process.env.EXPO_PUBLIC_APP_VARIANT === 'normal';

/**
 * Firebase settings for Android push (one file covers both apps). On EAS it is the file
 * variable GOOGLE_SERVICES_JSON, so the file is never in git.
 */
const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;

export default ({ config }: ConfigContext): ExpoConfig => {
  const android = {
    ...config.android,
    ...(googleServicesFile && { googleServicesFile }),
  };
  if (!normal) return { ...config, android } as ExpoConfig;
  return {
    ...config,
    name: 'ገብቷል Shop',
    slug: config.slug ?? 'smartVerify',
    scheme: 'smartverify-shop',
    android: {
      ...android,
      package: 'com.gebtual.shop',
      adaptiveIcon: { ...config.android?.adaptiveIcon, backgroundColor: '#FFF4E0' },
    },
  };
};
