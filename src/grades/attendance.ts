import type { AttendanceDay } from '@/hac/types';

/**
 * Counts attendance events by type ("Tardy", "Excused Absence", …) for the stats row on
 * the Attendance screen. HAC lists the type first on each day, followed by details like
 * the period, which are ignored here.
 */
export function summarizeAttendance(days: AttendanceDay[]): { type: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const d of days) {
    const type = d.events[0]?.trim();
    if (type) counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return [...counts.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
}
