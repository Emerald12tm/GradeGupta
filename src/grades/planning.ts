import type { Course, HacTable } from '@/hac/types';
import { semesterColumns } from '@/hac/parsers/pages';

import { computeGpa, type GpaResult, type GpaScale } from './gpa';
import { requiredExamScore, type SemesterWeights } from './semester';
import { requiredAssignmentScore } from './target';

/**
 * Planning tools built on the grade math: GPA projection, per-class goals and the
 * final exam planner. Pure functions, so they're unit tested without a phone.
 */

// ---------- GPA planner ----------

export interface GpaProjection {
  current: GpaResult;
  projected: GpaResult;
}

/**
 * Current GPA vs GPA if each class ended at the grade the user typed in `projected`
 * (keyed by course id; missing entries keep the current average).
 */
export function projectGpa(
  courses: Course[],
  projected: Record<string, number | undefined>,
  scale: GpaScale,
  isExcluded: (course: Course) => boolean = () => false,
): GpaProjection {
  const counted = courses.filter((c) => !isExcluded(c));
  const inputs = (pick: (c: Course) => number | null) =>
    counted.flatMap((c) => {
      const grade = pick(c);
      return grade === null ? [] : [{ grade, credits: c.credits, level: c.level }];
    });
  return {
    current: computeGpa(inputs((c) => c.reportedAverage), scale),
    projected: computeGpa(inputs((c) => projected[c.id] ?? c.reportedAverage), scale),
  };
}

// ---------- Goals ----------

export interface GoalStatus {
  goal: number;
  met: boolean;
  /** Points above (+) or below (−) the goal. */
  gap: number;
  /** Category with the most weight: the quickest way to move the average. */
  category: string | null;
  /** Percent needed on the next 100-point assignment in `category` to reach the goal; 0 if already there, null if out of reach. */
  nextNeeded: number | null;
}

export function goalStatus(course: Course, goal: number): GoalStatus | null {
  if (course.reportedAverage === null) return null;
  const category = [...course.categories].sort((a, b) => b.weight - a.weight)[0]?.name ?? null;
  const gap = course.reportedAverage - goal;
  return {
    goal,
    met: gap >= 0,
    gap,
    category,
    nextNeeded: category ? requiredAssignmentScore(course, category, 100, goal) : null,
  };
}

// ---------- Final exam planner ----------

export interface FinalPlan {
  course: string;
  /** Grading period grades used; `estimated` marks ones taken from the live class average. */
  periods: { grade: number; estimated: boolean }[];
  /** Exam score needed to finish the semester with 90 / 80 / 70 (HAC rounding applied). */
  needFor: { A: number; B: number; C: number };
}

const num = (s: string | undefined) => {
  const n = Number((s ?? '').trim());
  return (s ?? '').trim() !== '' && Number.isFinite(n) ? n : null;
};

/**
 * For every class on the report card in its current semester (no semester grade yet),
 * the final exam score needed for an A, B and C.
 *
 * Periods not posted yet use the live class average (by course name), since that is
 * where the current grading period is heading. Classes with nothing to go on are skipped.
 */
export function finalsPlan(reportCard: HacTable, weights: SemesterWeights, liveAverages: Record<string, number> = {}): FinalPlan[] {
  const groups = semesterColumns(reportCard.headers);
  const plans: FinalPlan[] = [];
  for (const row of reportCard.rows) {
    const name = row.Description || row.Course || '';
    const group = [...groups].reverse().find((g) => !num(row[g.semester]) && g.periods.some((p) => num(row[p]) !== null))
      ?? groups.find((g) => !num(row[g.semester]));
    if (!group || group.periods.length !== weights.periods.length) continue;

    const live = liveAverages[name.toLowerCase()];
    const periods = group.periods.map((p) => {
      const posted = num(row[p]);
      return posted !== null ? { grade: posted, estimated: false } : live !== undefined ? { grade: live, estimated: true } : null;
    });
    if (periods.some((p) => p === null)) continue;
    const grades = (periods as { grade: number; estimated: boolean }[]).map((p) => p.grade);
    plans.push({
      course: name,
      periods: periods as FinalPlan['periods'],
      needFor: {
        A: requiredExamScore(grades, 90, weights),
        B: requiredExamScore(grades, 80, weights),
        C: requiredExamScore(grades, 70, weights),
      },
    });
  }
  return plans;
}
