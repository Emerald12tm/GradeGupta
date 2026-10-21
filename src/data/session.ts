import { create } from 'zustand';

import { HacClient, HacError, type HacCredentials } from '@/hac/client';
import { clearCredentials, loadCredentials, saveCredentials } from '@/storage/credentials';
import { clearAllData } from '@/storage/db';

/**
 * Sign-in state and the shared HAC client.
 *
 * `status` drives navigation: 'loading' while we read the secure store at launch,
 * 'signedOut' shows the login screen, 'signedIn' shows the app.
 */

type Status = 'loading' | 'signedOut' | 'signedIn';

interface SessionState {
  status: Status;
  /** District origin, shown in Settings. */
  baseUrl: string | null;
  username: string | null;
  restore: () => Promise<void>;
  signIn: (credentials: HacCredentials) => Promise<void>;
  signOut: () => Promise<void>;
}

let client: HacClient | null = null;

/** The signed-in client. Throws if called while signed out. */
export function getClient(): HacClient {
  if (!client) throw new HacError('bad-credentials', 'Not signed in');
  return client;
}

export const useSession = create<SessionState>((set) => ({
  status: 'loading',
  baseUrl: null,
  username: null,

  restore: async () => {
    const saved = await loadCredentials();
    if (!saved) {
      set({ status: 'signedOut' });
      return;
    }
    client = new HacClient(saved);
    set({ status: 'signedIn', baseUrl: client.baseUrl, username: saved.username });
  },

  signIn: async (credentials) => {
    const candidate = new HacClient(credentials);
    await candidate.login(); // throws HacError with a user-facing message on failure
    await saveCredentials({ ...credentials, baseUrl: candidate.baseUrl });
    client = candidate;
    set({ status: 'signedIn', baseUrl: candidate.baseUrl, username: credentials.username });
  },

  signOut: async () => {
    await client?.logout();
    client = null;
    await clearCredentials();
    await clearAllData();
    set({ status: 'signedOut', baseUrl: null, username: null });
  },
}));
