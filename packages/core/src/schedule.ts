/** Bell schedule tracker + planner time-blocking. Times are "HH:MM" in the school's local time. */

export interface Period {
  name: string; // "1st", "Lunch", "Advisory"...
  start: string;
  end: string;
}

export interface BellSchedule {
  id: string;
  name: string; // "A Day", "B Day", "Early Release"
  periods: Period[];
}

const toMinutes = (hhmm: string) => {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;

export type BellStatus =
  | { state: 'before_school'; next: Period; minutesUntil: number }
  | { state: 'in_period'; current: Period; minutesLeft: number; next?: Period }
  | { state: 'passing'; next: Period; minutesUntil: number }
  | { state: 'after_school' };

export function bellStatus(schedule: BellSchedule, now: Date = new Date()): BellStatus {
  const t = minutesOfDay(now);
  const periods = [...schedule.periods].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  const first = periods[0];
  if (!first) return { state: 'after_school' };
  if (t < toMinutes(first.start)) return { state: 'before_school', next: first, minutesUntil: toMinutes(first.start) - t };

  for (let i = 0; i < periods.length; i++) {
    const p = periods[i]!;
    const next = periods[i + 1];
    if (t >= toMinutes(p.start) && t < toMinutes(p.end)) {
      return { state: 'in_period', current: p, minutesLeft: toMinutes(p.end) - t, next };
    }
    if (next && t >= toMinutes(p.end) && t < toMinutes(next.start)) {
      return { state: 'passing', next, minutesUntil: toMinutes(next.start) - t };
    }
  }
  return { state: 'after_school' };
}

/**
 * A/B day rotation: counts school days (Mon–Fri, skipping `holidays`) from an anchor
 * date whose letter is known. Returns the rotation label (e.g. "A" or "B"), or null on non-school days.
 */
export function rotationDay(anchor: Date, anchorIndex: number, date: Date, rotation: string[], holidays: string[] = []) {
  const skip = new Set(holidays);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if ([0, 6].includes(date.getDay()) || skip.has(iso(date))) return null;
  const step = date >= anchor ? 1 : -1;
  let count = 0;
  const d = new Date(anchor);
  while (iso(d) !== iso(date)) {
    d.setDate(d.getDate() + step);
    if (![0, 6].includes(d.getDay()) && !skip.has(iso(d))) count += step;
  }
  const n = rotation.length;
  return rotation[(((anchorIndex + count) % n) + n) % n] ?? null;
}

export interface PlannerTask {
  id: string;
  title: string;
  dueAt: string; // ISO datetime
  estimatedMinutes: number;
}

export interface TimeBlock {
  taskId: string;
  start: Date;
  end: Date;
}

/**
 * Greedy Pomodoro scheduler: fills free windows (e.g. after school until bedtime)
 * with 25-minute focus blocks + 5-minute breaks, earliest-due task first.
 */
export function timeBlock(
  tasks: PlannerTask[],
  freeWindows: { start: Date; end: Date }[],
  { focus = 25, rest = 5 } = {},
): { blocks: TimeBlock[]; unscheduled: string[] } {
  const queue = [...tasks]
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .map((t) => ({ ...t, remaining: t.estimatedMinutes }));
  const blocks: TimeBlock[] = [];
  const windows = [...freeWindows].sort((a, b) => +a.start - +b.start);

  for (const w of windows) {
    let cursor = new Date(w.start);
    for (const task of queue) {
      while (task.remaining > 0 && new Date(task.dueAt) > cursor) {
        const len = Math.min(focus, task.remaining, (+w.end - +cursor) / 60000);
        if (len < 10) break; // not worth starting a block shorter than 10 minutes
        const end = new Date(+cursor + len * 60000);
        blocks.push({ taskId: task.id, start: cursor, end });
        task.remaining -= len;
        cursor = new Date(+end + rest * 60000);
      }
    }
  }
  return { blocks, unscheduled: queue.filter((t) => t.remaining > 0).map((t) => t.id) };
}
