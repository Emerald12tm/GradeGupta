import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Local notifications only. There is no push server: the background task checks HAC
 * and posts notifications from the device itself.
 *
 * expo-notifications is loaded lazily because Expo Go on Android doesn't include it
 * (importing it there crashes the app). In that environment every function here quietly
 * does nothing; development and store builds get full notifications.
 */

type NotificationsModule = typeof import('expo-notifications');

const CHANNEL = 'grades';

let loaded: NotificationsModule | null | undefined;

function notifications(): NotificationsModule | null {
  if (loaded !== undefined) return loaded;
  const expoGoAndroid = Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  if (expoGoAndroid || Platform.OS === 'web') return (loaded = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = require('expo-notifications') as NotificationsModule;
  } catch {
    loaded = null;
  }
  return loaded;
}

/** Whether this build can show notifications at all (false in Expo Go on Android and on web). */
export const notificationsAvailable = (): boolean => notifications() !== null;

/** Show notifications even while the app is open. Call once at startup. */
export function configureNotifications(): void {
  notifications()?.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function ensureChannel(N: NotificationsModule) {
  if (Platform.OS === 'android') {
    await N.setNotificationChannelAsync(CHANNEL, {
      name: 'Grade updates',
      importance: N.AndroidImportance.DEFAULT,
    });
  }
}

/** Asks for permission if we don't have it yet. Returns whether notifications are allowed. */
export async function requestNotificationPermission(): Promise<boolean> {
  const N = notifications();
  if (!N) return false;
  await ensureChannel(N);
  const current = await N.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await N.requestPermissionsAsync();
  return asked.granted;
}

/** Posts a notification right away. Silently does nothing without permission. */
export async function notify(title: string, body: string): Promise<void> {
  const N = notifications();
  if (!N) return;
  const { granted } = await N.getPermissionsAsync();
  if (!granted) return;
  await ensureChannel(N);
  await N.scheduleNotificationAsync({
    content: { title, body },
    trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null,
  });
}

/** Schedules a planner reminder. Returns its id (to cancel), or null if not allowed / in the past. */
export async function scheduleReminder(title: string, date: Date): Promise<string | null> {
  const N = notifications();
  if (!N || date.getTime() <= Date.now()) return null;
  if (!(await requestNotificationPermission())) return null;
  return N.scheduleNotificationAsync({
    content: { title: 'Reminder', body: title },
    trigger: {
      type: N.SchedulableTriggerInputTypes.DATE,
      date,
      ...(Platform.OS === 'android' ? { channelId: CHANNEL } : {}),
    },
  });
}

export async function cancelReminder(id: string | null): Promise<void> {
  const N = notifications();
  if (N && id) await N.cancelScheduledNotificationAsync(id);
}
