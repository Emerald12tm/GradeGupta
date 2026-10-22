import { computeGpa } from '@/grades/gpa';
import type { HacClient } from '@/hac/client';
import type { AssignmentsPage, Course } from '@/hac/types';
import { applyCourseOverrides, gpaScaleFor, loadSettings, type Settings } from '@/settings/settings';
import { getSnapshot, recordCourseHistory, recordGpa, saveSnapshot } from '@/storage/db';

import { describeChange, diffSnapshots, type GradeChange } from './diff';
import { notify } from './notifications';

/**
 * One grade sync: scrape → compare with the last snapshot → save → (optionally) notify.
 *
 * Shared by pull-to-refresh in the app and by the background task, so both record
 * history and detect changes the same way.
 */

export interface SyncResult {
  page: AssignmentsPage;
  changes: GradeChange[];
  syncedAt: string;
  /** Marking period key the snapshot was saved under. */
  markingPeriod: string;
}

export interface SyncOptions {
  /** Marking period to load. Omit for the current one (the only one that records history). */
  markingPeriod?: string;
  /** Send local notifications for changes (background syncs). */
  notify?: boolean;
  /** Account whose database to use. Defaults to the active account. */
  accountId?: string;
  /** Prefix for notification titles, e.g. the student's name when several accounts exist. */
  label?: string;
}

export async function syncGrades(client: HacClient, options: SyncOptions = {}): Promise<SyncResult> {
  const { accountId } = options;
  const settings = await loadSettings();
  const page = await client.getAssignments(options.markingPeriod);
  page.courses = applyCourseOverrides(page.courses, settings.courseOverrides);

  const markingPeriod = page.markingPeriods.find((p) => p.selected)?.value ?? 'current';
  const syncedAt = new Date().toISOString();
  const previous = await getSnapshot(markingPeriod, accountId);
  const changes = previous ? diffSnapshots(previous.courses, page.courses) : [];

  await saveSnapshot({ markingPeriod, takenAt: syncedAt, courses: page.courses }, accountId);

  if (!options.markingPeriod) {
    // Also saved under 'current' so offline launches can find it without knowing the period key.
    await saveSnapshot({ markingPeriod: 'current', takenAt: syncedAt, courses: page.courses }, accountId);
    await recordCourseHistory(page.courses, syncedAt, accountId);
    const gpa = currentGpa(page.courses, settings);
    await recordGpa({ takenAt: syncedAt, weighted: gpa.weighted, unweighted: gpa.unweighted }, accountId);
  }

  if (options.notify) {
    for (const m of selectNotifications(changes, previous?.courses ?? [], page.courses, settings)) {
      await notify(options.label ? `${options.label}: ${m.title}` : m.title, m.body);
    }
  }
  return { page, changes, syncedAt, markingPeriod };
}

/** GPA from the current class averages, honoring "exclude from GPA" overrides. */
export function currentGpa(courses: Course[], settings: Settings) {
  return computeGpa(
    courses
      .filter((c) => c.reportedAverage !== null && !settings.courseOverrides[c.name]?.excludeFromGpa)
      .map((c) => ({ grade: c.reportedAverage as number, credits: c.credits, level: c.level })),
    gpaScaleFor(settings),
  );
}

/** Courses whose average just dropped below the alert threshold. */
export function crossedBelow(previous: Course[], current: Course[], threshold: number): Course[] {
  const before = new Map(previous.map((c) => [c.id, c.reportedAverage]));
  return current.filter((c) => {
    const old = before.get(c.id);
    return c.reportedAverage !== null && c.reportedAverage < threshold && (old === undefined || old === null || old >= threshold);
  });
}

/** Picks which changes to notify about per settings; bundles many into one summary. */
export function selectNotifications(
  changes: GradeChange[],
  previous: Course[],
  current: Course[],
  settings: Settings,
): { title: string; body: string }[] {
  const wanted = changes.filter((c) =>
    c.kind === 'average-changed'
      ? settings.notifyAverages && Math.abs(c.to - c.from) >= settings.minAverageChange
      : settings.notifyGrades,
  );
  const messages =
    wanted.length > 3
      ? [{ title: `${wanted.length} grade updates`, body: [...new Set(wanted.map((c) => c.courseName))].join(', ') }]
      : wanted.map(describeChange);

  if (settings.lowGradeAlert !== null) {
    for (const c of crossedBelow(previous, current, settings.lowGradeAlert)) {
      messages.push({
        title: `${c.name} is below ${settings.lowGradeAlert}`,
        body: `Your average is now ${c.reportedAverage?.toFixed(2)}.`,
      });
    }
  }
  return messages;
}
