import { z } from 'zod';
import { encrypt } from '@/lib/crypto';
import { HacError, HacSession, normalizeBaseUrl } from '@/lib/hac/client';
import { adminClient, getUser } from '@/lib/supabase/server';

const Body = z.object({
  baseUrl: z.string().min(3),
  username: z.string().min(1),
  password: z.string().min(1),
  displayName: z.string().max(60).optional(),
});

/** Verifies HAC credentials, then saves them (encrypted) as a new student profile. */
export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid request' }, { status: 400 });
  const { username, password, displayName } = parsed.data;

  try {
    const baseUrl = normalizeBaseUrl(parsed.data.baseUrl);
    await HacSession.login(baseUrl, username, password);

    const { data, error } = await adminClient()
      .from('student_accounts')
      .upsert(
        {
          owner_id: user.id,
          hac_base_url: baseUrl,
          hac_username: username,
          hac_password_enc: encrypt(password),
          display_name: displayName ?? null,
        },
        { onConflict: 'owner_id,hac_base_url,hac_username' },
      )
      .select('id, display_name, hac_base_url, hac_username')
      .single();
    if (error) throw error;
    return Response.json({ student: data });
  } catch (e) {
    if (e instanceof HacError) return Response.json({ error: e.message }, { status: e.status });
    console.error(e);
    return Response.json({ error: 'Failed to link account' }, { status: 500 });
  }
}
