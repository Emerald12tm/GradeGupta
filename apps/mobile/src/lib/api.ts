import { supabase } from './supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL!; // the Vercel deployment, e.g. https://shauryagrades.vercel.app

/** Calls the Next.js API on Vercel with the user's Supabase session. */
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`${API_URL}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`);
  return res.json() as Promise<T>;
}
