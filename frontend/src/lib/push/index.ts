import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import i18n from '@/i18n';
import { api } from '@/lib/api/client';
import { USE_MOCK_NOTIFICATIONS } from '@/lib/notifications';

/** Android shows our alerts in this channel (sound, heads-up). Same id as the server sends. */
const CHANNEL_ID = 'alerts';

// A push that arrives while the app is open still shows as a banner with sound.
Notifications.setNotificationHandler({
  handleNotification: async () => {
    await Promise.resolve();
    return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    };
  },
});

/**
 * Lets this phone get notifications when the app is closed: asks permission once, gets the
 * phone's push token and tells the server who is signed in here. Quietly does nothing where
 * push cannot work (Expo Go, emulator, web, permission refused, offline).
 */
export async function registerForPush(): Promise<void> {
  if (USE_MOCK_NOTIFICATIONS || Platform.OS === 'web' || !Device.isDevice) return;
  // Expo Go cannot receive pushes for this app: only the installed app can.
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: i18n.t('notifications.title'),
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;

    const projectId = (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)
      ?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api('/notifications/push-token', {
      method: 'PUT',
      body: { token, language: i18n.language === 'am' ? 'am' : 'en' },
    });
  } catch (error) {
    // Push is extra: the in-app Alerts tab still works without it.
    if (__DEV__) console.warn('push registration failed', error);
  }
}
