import type { Course } from '@/hac/types';

/**
 * Compares two grade snapshots and lists what changed, for notifications and the
 * "since last check" arrows on the class list.
 *
 * Assignments are matched by id within the same course id. Courses that appear or
 * disappear (schedule changes, new marking period) are ignored rather than reported as
 * dozens of "new grades".
 */

export type GradeChange =
  | {
      kind: 'new-grade';
      courseId: string;
      courseName: string;
      assignment: string;
      score: number;
      totalPoints: number;
    }
  | {
      kind: 'grade-changed';
      courseId: string;
      courseName: string;
      assignment: string;
      from: number | null;
      to: number | null;
      totalPoints: number;
    }
  | {
      kind: 'average-changed';
      courseId: string;
      courseName: string;
      from: number;
      to: number;
    };

export function diffSnapshots(previous: Course[], current: Course[]): GradeChange[] {
  const changes: GradeChange[] = [];
  const prevById = new Map(previous.map((c) => [c.id, c]));

  for (const course of current) {
    const before = prevById.get(course.id);
    if (!before) continue;

    const prevAssignments = new Map(before.assignments.map((a) => [a.id, a]));
    for (const a of course.assignments) {
      const old = prevAssignments.get(a.id);
      if (!old || old.score === null) {
        if (a.score !== null) {
          changes.push({
            kind: 'new-grade',
            courseId: course.id,
            courseName: course.name,
            assignment: a.name,
            score: a.score,
            totalPoints: a.totalPoints,
          });
        }
      } else if (old.score !== a.score) {
        changes.push({
          kind: 'grade-changed',
          courseId: course.id,
          courseName: course.name,
          assignment: a.name,
          from: old.score,
          to: a.score,
          totalPoints: a.totalPoints,
        });
      }
    }

    if (
      before.reportedAverage !== null &&
      course.reportedAverage !== null &&
      Math.abs(before.reportedAverage - course.reportedAverage) >= 0.005
    ) {
      changes.push({
        kind: 'average-changed',
        courseId: course.id,
        courseName: course.name,
        from: before.reportedAverage,
        to: course.reportedAverage,
      });
    }
  }
  return changes;
}

/** Notification text for one change. */
export function describeChange(c: GradeChange): { title: string; body: string } {
  const fmt = (n: number | null) => (n === null ? '—' : String(Math.round(n * 100) / 100));
  switch (c.kind) {
    case 'new-grade':
      return {
        title: `New grade in ${c.courseName}`,
        body:
          c.totalPoints === 0
            ? `${c.assignment}: +${fmt(c.score)} extra credit`
            : `${c.assignment}: ${fmt(c.score)}/${fmt(c.totalPoints)}`,
      };
    case 'grade-changed':
      return {
        title: `Grade updated in ${c.courseName}`,
        body: `${c.assignment}: ${fmt(c.from)} → ${fmt(c.to)} ${c.totalPoints === 0 ? '(extra credit)' : `(out of ${fmt(c.totalPoints)})`}`,
      };
    case 'average-changed':
      return { title: `${c.courseName} average changed`, body: `${c.from.toFixed(2)} → ${c.to.toFixed(2)}` };
  }
}
