import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import i18n from '@/i18n';
import { api } from '@/lib/api/client';
import { USE_MOCK_NOTIFICATIONS } from '@/lib/notifications';

/** Android shows our alerts in this channel (sound, heads-up). Same id as the server sends. */
const CHANNEL_ID = 'alerts';

/**
 * Push works only in the installed app. In Expo Go (and on web) expo-notifications is never
 * loaded: loading it there fails (it needs native parts Expo Go does not give this app).
 */
const pushPossible =
  !USE_MOCK_NOTIFICATIONS &&
  Platform.OS !== 'web' &&
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

type NotificationsModule = typeof import('expo-notifications');
let loaded: NotificationsModule | null = null;

/** expo-notifications, loaded on first use (null where push cannot work). */
function notifications(): NotificationsModule | null {
  if (!pushPossible) return null;
  if (!loaded) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = require('expo-notifications') as NotificationsModule;
    // A push that arrives while the app is open still shows as a banner with sound.
    loaded.setNotificationHandler({
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
  }
  return loaded;
}

/**
 * Lets this phone get notifications when the app is closed: asks permission once, gets the
 * phone's push token and tells the server who is signed in here. Quietly does nothing where
 * push cannot work (Expo Go, emulator, web, permission refused, offline).
 */
export async function registerForPush(): Promise<void> {
  const Notifications = notifications();
  if (!Notifications || !Device.isDevice) return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: i18n.t('notifications.title'),
        importance: Notifications.AndroidImportance.HIGH,
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

/**
 * Pushes while the app runs: onReceived when one arrives, onTapped when the person taps one.
 * Returns the cleanup. Does nothing where push cannot work.
 */
export function listenToPushes(onReceived: () => void, onTapped: () => void): () => void {
  const Notifications = notifications();
  if (!Notifications) return () => {};
  const received = Notifications.addNotificationReceivedListener(onReceived);
  const tapped = Notifications.addNotificationResponseReceivedListener(onTapped);
  return () => {
    received.remove();
    tapped.remove();
  };
}
