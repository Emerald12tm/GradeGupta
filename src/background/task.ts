import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { HacClient } from '@/hac/client';
import { loadSettings } from '@/settings/settings';
import { loadCredentials } from '@/storage/credentials';
import { syncGrades } from '@/sync/sync';

/**
 * Background grade check.
 *
 * The OS decides when this runs: at least `MINIMUM_INTERVAL_MINUTES` apart, usually
 * longer, and less often when the battery is low or the app is rarely opened. New-grade
 * alerts therefore arrive "within a while", not instantly. That's the trade-off for
 * keeping credentials on the device instead of on a server.
 *
 * `TaskManager.defineTask` must run at module load, so this file is imported from the
 * root layout.
 */

export const SYNC_TASK = 'gradegupta-background-sync';
const MINIMUM_INTERVAL_MINUTES = 30;

TaskManager.defineTask(SYNC_TASK, async () => {
  try {
    const settings = await loadSettings();
    const credentials = await loadCredentials();
    if (!settings.backgroundSync || !credentials) return BackgroundTask.BackgroundTaskResult.Success;
    await syncGrades(new HacClient(credentials), { notify: true });
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** Turns background checks on. Safe to call repeatedly. */
export async function enableBackgroundSync(): Promise<boolean> {
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return false;
  if (!(await TaskManager.isTaskRegisteredAsync(SYNC_TASK))) {
    await BackgroundTask.registerTaskAsync(SYNC_TASK, { minimumInterval: MINIMUM_INTERVAL_MINUTES });
  }
  return true;
}

export async function disableBackgroundSync(): Promise<void> {
  if (await TaskManager.isTaskRegisteredAsync(SYNC_TASK)) {
    await BackgroundTask.unregisterTaskAsync(SYNC_TASK);
  }
}

/** Debug builds only: runs the task now so notifications can be tested. */
export const runBackgroundSyncForTesting = () => BackgroundTask.triggerTaskWorkerForTestingAsync();
