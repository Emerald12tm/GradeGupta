import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Local notifications only. There is no push server: the background task checks HAC
 * and posts notifications from the device itself.
 */

const CHANNEL = 'grades';

/** Show notifications even while the app is open. Call once at startup. */
export function configureNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function ensureChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Grade updates',
      importance: AndroidImportance.DEFAULT,
    });
  }
}

/** Asks for permission if we don't have it yet. Returns whether notifications are allowed. */
export async function requestNotificationPermission(): Promise<boolean> {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/** Posts a notification right away. Silently does nothing without permission. */
export async function notify(title: string, body: string): Promise<void> {
  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) return;
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null,
  });
}

/** Schedules a planner reminder. Returns its id (to cancel), or null if not allowed / in the past. */
export async function scheduleReminder(title: string, date: Date): Promise<string | null> {
  if (date.getTime() <= Date.now()) return null;
  if (!(await requestNotificationPermission())) return null;
  return Notifications.scheduleNotificationAsync({
    content: { title: 'Reminder', body: title },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      ...(Platform.OS === 'android' ? { channelId: CHANNEL } : {}),
    },
  });
}

export async function cancelReminder(id: string | null): Promise<void> {
  if (id) await Notifications.cancelScheduledNotificationAsync(id);
}
