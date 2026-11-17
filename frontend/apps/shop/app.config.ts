import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Firebase settings for Android push (one file covers both apps). On EAS it is the file
 * variable GOOGLE_SERVICES_JSON, so the file is never in git.
 */
const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;

export default ({ config }: ConfigContext): ExpoConfig =>
  ({
    ...config,
    android: { ...config.android, ...(googleServicesFile && { googleServicesFile }) },
  }) as ExpoConfig;
