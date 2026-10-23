import type { Course } from '@/hac/types';
import type { HistoryPoint } from '@/storage/db';

/**
 * Weekly digest: one Sunday-evening notification summarizing the week, sent by the
 * background task. Pure helpers decide when to send and what it says.
 */

/** The Sunday (local time) starting the week of `date`, as YYYY-MM-DD. Identifies "this week". */
export function weekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Sunday from 5pm on, once per week. */
export function shouldSendDigest(now: Date, lastSentWeek: string | null): boolean {
  return now.getDay() === 0 && now.getHours() >= 17 && lastSentWeek !== weekKey(now);
}

const DAY = 24 * 60 * 60_000;

export function buildDigest(courses: Course[], history: HistoryPoint[], now: Date): { title: string; body: string } {
  const weekAgo = now.getTime() - 7 * DAY;
  const moves = courses
    .map((c) => {
      const points = history.filter((h) => h.courseId === c.id);
      const before = [...points].reverse().find((p) => new Date(p.takenAt).getTime() <= weekAgo) ?? points[0];
      return before && c.reportedAverage !== null ? { name: c.name, delta: c.reportedAverage - before.average } : null;
    })
    .filter((m): m is { name: string; delta: number } => m !== null && Math.abs(m.delta) >= 0.1)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const today = now.toISOString().slice(0, 10);
  const nextWeek = new Date(now.getTime() + 7 * DAY).toISOString().slice(0, 10);
  const missing = courses.reduce((n, c) => n + c.assignments.filter((a) => a.isMissing).length, 0);
  const dueSoon = courses.reduce(
    (n, c) => n + c.assignments.filter((a) => a.score === null && !a.isMissing && (a.dateDue ?? '') >= today && (a.dateDue ?? '') <= nextWeek).length,
    0,
  );

  const parts = [
    moves.length
      ? moves
          .slice(0, 2)
          .map((m) => `${m.name} ${m.delta > 0 ? '▲' : '▼'}${Math.abs(m.delta).toFixed(1)}`)
          .join(', ')
      : 'No big grade changes this week',
    missing ? `${missing} missing` : null,
    dueSoon ? `${dueSoon} due this week` : null,
  ].filter(Boolean);

  return { title: 'Your week in grades', body: parts.join(' · ') };
}
