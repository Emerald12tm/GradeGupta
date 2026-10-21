import * as SecureStore from 'expo-secure-store';

import type { HacCredentials } from '@/hac/client';

/**
 * HAC login, stored in the iOS Keychain / Android Keystore via expo-secure-store.
 *
 * `AFTER_FIRST_UNLOCK` lets the background sync read it while the phone is locked
 * (after it has been unlocked once since boot); it's still encrypted at rest and never
 * included in backups to other devices.
 */

const KEY = 'hac.credentials.v1';
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

export async function saveCredentials(credentials: HacCredentials): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(credentials), OPTIONS);
}

export async function loadCredentials(): Promise<HacCredentials | null> {
  const raw = await SecureStore.getItemAsync(KEY, OPTIONS);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as HacCredentials;
    return parsed.baseUrl && parsed.username && parsed.password ? parsed : null;
  } catch {
    return null;
  }
}

export async function clearCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY, OPTIONS);
}
