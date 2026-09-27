import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient, type User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Cookie-based client for Server Components / Route Handlers (website users). */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component — safe to ignore; the session is refreshed elsewhere.
        }
      },
    },
  });
}

/** Service-role client. Bypasses RLS — only use after checking the caller owns the row. */
export const adminClient = () =>
  createSupabaseClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

/**
 * Resolves the calling user from either a `Bearer` token (mobile app) or
 * Supabase auth cookies (website). Returns null if unauthenticated.
 */
export async function getUser(req: Request): Promise<User | null> {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (bearer) {
    const { data } = await adminClient().auth.getUser(bearer);
    return data.user;
  }
  const { data } = await (await createClient()).auth.getUser();
  return data.user;
}
