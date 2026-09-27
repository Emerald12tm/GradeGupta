import { syncStudent } from '@/lib/hac/sync';
import { adminClient } from '@/lib/supabase/server';

export const maxDuration = 300;

/**
 * Nightly background sync (scheduled in vercel.json) so Grade Insights has a daily
 * history even when nobody opens the app. Vercel sends `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  const { data: students } = await adminClient().from('student_accounts').select('id');
  let ok = 0;
  let failed = 0;
  // Small batches: be polite to district HAC servers.
  for (let i = 0; i < (students ?? []).length; i += 5) {
    const batch = students!.slice(i, i + 5);
    const results = await Promise.allSettled(batch.map((s) => syncStudent(s.id)));
    results.forEach((r) => (r.status === 'fulfilled' ? ok++ : failed++));
  }
  return Response.json({ ok, failed });
}
