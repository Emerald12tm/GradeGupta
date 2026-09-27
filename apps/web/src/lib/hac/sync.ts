import 'server-only';
import { createHash } from 'node:crypto';
import { decrypt } from '@/lib/crypto';
import { adminClient } from '@/lib/supabase/server';
import { HacSession } from './client';

/** Logs into HAC for one student, stores a snapshot (if changed) + daily averages, returns courses. */
export async function syncStudent(studentId: string) {
  const db = adminClient();
  const { data: acct, error } = await db
    .from('student_accounts')
    .select('id, hac_base_url, hac_username, hac_password_enc')
    .eq('id', studentId)
    .single();
  if (error || !acct) throw new Error('Student not found');

  const session = await HacSession.login(acct.hac_base_url, acct.hac_username, decrypt(acct.hac_password_enc));
  const courses = await session.getCourses();

  const hash = createHash('sha256').update(JSON.stringify(courses)).digest('hex');
  const { data: last } = await db
    .from('grade_snapshots')
    .select('content_hash')
    .eq('student_id', studentId)
    .order('taken_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (last?.content_hash !== hash) {
    await db.from('grade_snapshots').insert({ student_id: studentId, courses, content_hash: hash });
    await db.from('course_averages').upsert(
      courses.map((c) => ({ student_id: studentId, course_id: c.id, course_name: c.name, average: c.reportedAverage })),
    );
  }
  await db.from('student_accounts').update({ last_synced_at: new Date().toISOString() }).eq('id', studentId);
  return { courses, changed: last?.content_hash !== hash };
}
