import { z } from 'zod';
import { HacError } from '@/lib/hac/client';
import { syncStudent } from '@/lib/hac/sync';
import { adminClient, getUser } from '@/lib/supabase/server';

export const maxDuration = 60;

const Body = z.object({ studentId: z.uuid() });

/** Pulls fresh grades from HAC for one of the caller's student profiles. */
export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid request' }, { status: 400 });

  const { data: owned } = await adminClient()
    .from('student_accounts')
    .select('id')
    .eq('id', parsed.data.studentId)
    .eq('owner_id', user.id)
    .maybeSingle();
  if (!owned) return Response.json({ error: 'Not found' }, { status: 404 });

  try {
    return Response.json(await syncStudent(owned.id));
  } catch (e) {
    if (e instanceof HacError) return Response.json({ error: e.message }, { status: e.status });
    console.error(e);
    return Response.json({ error: 'Sync failed' }, { status: 500 });
  }
}
