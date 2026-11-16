import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Firebase settings for Android push (one file covers both apps). On EAS it is the file
 * variable GOOGLE_SERVICES_JSON, so the file is never in git.
 */
const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;

/** Google Maps key for the business-location map (set GOOGLE_MAPS_API_KEY on EAS; never in git). */
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

export default ({ config }: ConfigContext): ExpoConfig =>
  ({
    ...config,
    ios: { ...config.ios, ...(googleMapsApiKey && { config: { googleMapsApiKey } }) },
    android: {
      ...config.android,
      ...(googleServicesFile && { googleServicesFile }),
      ...(googleMapsApiKey && { config: { googleMaps: { apiKey: googleMapsApiKey } } }),
    },
  }) as ExpoConfig;
