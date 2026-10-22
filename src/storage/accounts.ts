import * as SecureStore from 'expo-secure-store';

import type { HacCredentials } from '@/hac/client';

/**
 * Saved HAC accounts (e.g. you and a sibling, or two districts), stored in the iOS Keychain /
 * Android Keystore via expo-secure-store.
 *
 * - `accounts.v1` holds the list (no passwords) and which account is active.
 * - `account.<id>.password` holds each password separately.
 *
 * `AFTER_FIRST_UNLOCK` lets the background sync read them while the phone is locked (after
 * it has been unlocked once since boot); they're encrypted at rest and not synced to other
 * devices.
 */

export interface Account {
  id: string;
  /** HAC origin, e.g. https://hac.friscoisd.org */
  baseUrl: string;
  username: string;
  /** From the district list, when the address matched one. */
  districtName?: string;
  /** From HAC's registration page after the first sign-in. */
  studentName?: string;
}

interface AccountIndex {
  accounts: Account[];
  activeId: string | null;
}

const INDEX_KEY = 'accounts.v1';
const LEGACY_KEY = 'hac.credentials.v1';
const passwordKey = (id: string) => `account.${id}.password`;
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

/** Display name for an account: student name, else username, plus district when known. */
export const accountLabel = (a: Account): string => a.studentName ?? a.username;

async function readIndex(): Promise<AccountIndex> {
  const raw = await SecureStore.getItemAsync(INDEX_KEY, OPTIONS);
  if (!raw) return { accounts: [], activeId: null };
  try {
    return JSON.parse(raw) as AccountIndex;
  } catch {
    return { accounts: [], activeId: null };
  }
}

async function writeIndex(index: AccountIndex): Promise<void> {
  await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(index), OPTIONS);
}

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Accounts saved by the single-account version are moved into the list once. */
async function migrateLegacy(): Promise<void> {
  const raw = await SecureStore.getItemAsync(LEGACY_KEY, OPTIONS);
  if (!raw) return;
  try {
    const legacy = JSON.parse(raw) as HacCredentials;
    if (legacy.baseUrl && legacy.username && legacy.password) {
      await saveAccount({ baseUrl: legacy.baseUrl, username: legacy.username }, legacy.password);
    }
  } finally {
    await SecureStore.deleteItemAsync(LEGACY_KEY, OPTIONS);
  }
}

export async function listAccounts(): Promise<AccountIndex> {
  await migrateLegacy();
  return readIndex();
}

/**
 * Adds an account, or updates it if the same username on the same district is already saved,
 * and makes it active. Returns the saved account.
 */
export async function saveAccount(details: Omit<Account, 'id'>, password: string): Promise<Account> {
  const index = await readIndex();
  const existing = index.accounts.find((a) => a.baseUrl === details.baseUrl && a.username === details.username);
  const account: Account = { ...existing, ...details, id: existing?.id ?? newId() };
  const accounts = existing ? index.accounts.map((a) => (a.id === account.id ? account : a)) : [...index.accounts, account];
  await SecureStore.setItemAsync(passwordKey(account.id), password, OPTIONS);
  await writeIndex({ accounts, activeId: account.id });
  return account;
}

export async function updateAccount(id: string, patch: Partial<Omit<Account, 'id'>>): Promise<void> {
  const index = await readIndex();
  await writeIndex({ ...index, accounts: index.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
}

export async function setActiveAccountId(id: string): Promise<void> {
  await writeIndex({ ...(await readIndex()), activeId: id });
}

/** Full credentials for one account, or null if its password is missing. */
export async function loadCredentials(id: string): Promise<HacCredentials | null> {
  const account = (await readIndex()).accounts.find((a) => a.id === id);
  const password = await SecureStore.getItemAsync(passwordKey(id), OPTIONS);
  return account && password ? { baseUrl: account.baseUrl, username: account.username, password } : null;
}

/** Removes an account. If it was active, the first remaining account becomes active. */
export async function removeAccount(id: string): Promise<AccountIndex> {
  const index = await readIndex();
  const accounts = index.accounts.filter((a) => a.id !== id);
  const activeId = index.activeId === id ? (accounts[0]?.id ?? null) : index.activeId;
  await SecureStore.deleteItemAsync(passwordKey(id), OPTIONS);
  await writeIndex({ accounts, activeId });
  return { accounts, activeId };
}
