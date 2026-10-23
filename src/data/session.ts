import { create } from 'zustand';

import { districtForUrl } from '@/config/districts';
import { HacError, type HacClient, type HacCredentials } from '@/hac/client';
import { createClient } from '@/hac/demo';
import {
  listAccounts,
  loadCredentials,
  removeAccount as removeSavedAccount,
  saveAccount,
  setActiveAccountId,
  updateAccount,
  type Account,
} from '@/storage/accounts';
import { deleteAccountData, setActiveAccount } from '@/storage/db';

/**
 * Saved accounts, the active one, and its HAC client.
 *
 * `status` drives navigation: 'loading' while we read the secure store at launch,
 * 'signedOut' (no accounts) shows the login screen, 'signedIn' shows the app.
 *
 * Only the active account has a client. Switching accounts always creates a fresh client,
 * which signs in again: every account shares the phone's cookie store, so a client kept
 * from before could otherwise be looking at another student's session.
 */

type Status = 'loading' | 'signedOut' | 'signedIn';

interface SessionState {
  status: Status;
  accounts: Account[];
  activeId: string | null;
  restore: () => Promise<void>;
  /** Signs in to HAC, saves the account and makes it active. Throws HacError on failure. */
  addAccount: (credentials: HacCredentials & { districtName?: string }) => Promise<void>;
  switchAccount: (id: string) => Promise<void>;
  /** Signs out of one account and deletes its saved grades. */
  removeAccount: (id: string) => Promise<void>;
}

let client: HacClient | null = null;

/** The active account's client. Throws if no account is active. */
export function getClient(): HacClient {
  if (!client) throw new HacError('bad-credentials', 'Not signed in');
  return client;
}

/** The active account, for labels. */
export const useActiveAccount = (): Account | undefined =>
  useSession((s) => s.accounts.find((a) => a.id === s.activeId));

async function activate(id: string | null): Promise<void> {
  setActiveAccount(id);
  client = null;
  if (!id) return;
  const credentials = await loadCredentials(id);
  if (credentials) client = createClient(credentials);
}

export const useSession = create<SessionState>((set, get) => ({
  status: 'loading',
  accounts: [],
  activeId: null,

  restore: async () => {
    const { accounts, activeId } = await listAccounts();
    const id = activeId ?? accounts[0]?.id ?? null;
    await activate(id);
    set({ accounts, activeId: id, status: id && client ? 'signedIn' : 'signedOut' });
  },

  addAccount: async ({ districtName, ...credentials }) => {
    const candidate = createClient(credentials);
    await candidate.login();
    const studentName = await candidate
      .getStudentInfo()
      .then((info) => info.name)
      .catch(() => undefined);

    const account = await saveAccount(
      {
        baseUrl: candidate.baseUrl,
        username: credentials.username,
        districtName: districtName ?? districtForUrl(candidate.baseUrl)?.name,
        studentName,
      },
      credentials.password,
    );
    setActiveAccount(account.id);
    client = candidate;
    const { accounts } = await listAccounts();
    set({ accounts, activeId: account.id, status: 'signedIn' });
  },

  switchAccount: async (id) => {
    if (id === get().activeId) return;
    await setActiveAccountId(id);
    await activate(id);
    set({ activeId: id });
  },

  removeAccount: async (id) => {
    if (id === get().activeId) await client?.logout();
    const { accounts, activeId } = await removeSavedAccount(id);
    await deleteAccountData(id);
    await activate(activeId);
    set({ accounts, activeId, status: activeId ? 'signedIn' : 'signedOut' });
  },
}));

/** Saves a better display name for the active account once HAC tells us the student's name. */
export async function rememberStudentName(name: string | undefined): Promise<void> {
  const { activeId, accounts } = useSession.getState();
  const account = accounts.find((a) => a.id === activeId);
  if (!activeId || !name || account?.studentName === name) return;
  await updateAccount(activeId, { studentName: name });
  useSession.setState({ accounts: accounts.map((a) => (a.id === activeId ? { ...a, studentName: name } : a)) });
}
