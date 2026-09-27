import type { Assignment, Category, Course } from './types';

export interface CategoryResult {
  name: string;
  weight: number;
  /** Weight after redistributing empty categories so the active ones sum to 100. */
  effectiveWeight: number;
  earned: number;
  possible: number;
  /** Percent, or null when the category has no graded assignments. */
  average: number | null;
}

const isGraded = (a: Assignment) => a.score !== null && a.totalPoints > 0;

/** Category average = (earned + mock earned) / (possible + mock possible) × 100. */
export function categoryTotals(assignments: Assignment[], category: string) {
  let earned = 0;
  let possible = 0;
  for (const a of assignments) {
    if (a.category !== category || !isGraded(a)) continue;
    const w = a.weight ?? 1;
    earned += (a.score as number) * w;
    possible += a.totalPoints * w;
  }
  return { earned, possible, average: possible > 0 ? (earned / possible) * 100 : null };
}

/**
 * Weighted overall average. Categories with no graded work are dropped and their
 * weight is redistributed proportionally across the active categories.
 */
export function computeAverage(
  categories: Category[],
  assignments: Assignment[],
): { average: number | null; categories: CategoryResult[] } {
  const rows = categories.map((c) => ({ ...c, ...categoryTotals(assignments, c.name) }));
  const activeWeight = rows.reduce((sum, r) => (r.average === null ? sum : sum + r.weight), 0);

  const results: CategoryResult[] = rows.map((r) => ({
    name: r.name,
    weight: r.weight,
    effectiveWeight: r.average === null || activeWeight === 0 ? 0 : (r.weight / activeWeight) * 100,
    earned: r.earned,
    possible: r.possible,
    average: r.average,
  }));

  if (activeWeight === 0) {
    // Unweighted course (or no categories configured): plain points-based average.
    const t = assignments.filter(isGraded);
    const possible = t.reduce((s, a) => s + a.totalPoints * (a.weight ?? 1), 0);
    const earned = t.reduce((s, a) => s + (a.score as number) * (a.weight ?? 1), 0);
    return { average: possible > 0 ? (earned / possible) * 100 : null, categories: results };
  }

  const average = results.reduce(
    (sum, r) => (r.average === null ? sum : sum + (r.average * r.effectiveWeight) / 100),
    0,
  );
  return { average, categories: results };
}

/** "What if": inject mock grades into their categories and recompute. */
export function whatIf(course: Course, mocks: Assignment[]) {
  const before = computeAverage(course.categories, course.assignments).average;
  const after = computeAverage(course.categories, [
    ...course.assignments,
    ...mocks.map((m) => ({ ...m, isMock: true })),
  ]);
  return { before, after: after.average, delta: before !== null && after.average !== null ? after.average - before : null, categories: after.categories };
}

/**
 * Target grade / final exam calculator.
 * Required = (Target − Current × (1 − ExamWeight)) / ExamWeight
 * @param examWeight fraction in (0, 1], e.g. 0.15 for 15%
 */
export function requiredExamScore(current: number, target: number, examWeight: number): number {
  if (examWeight <= 0 || examWeight > 1) throw new RangeError('examWeight must be in (0, 1]');
  return (target - current * (1 - examWeight)) / examWeight;
}

/**
 * Score needed on a single upcoming assignment (worth `totalPoints`, in `category`)
 * to reach `target` overall. Solved by bisection so it respects category weighting
 * and redistribution exactly. Returns null if unreachable even with 100% × 2.
 */
export function requiredAssignmentScore(
  course: Course,
  category: string,
  totalPoints: number,
  target: number,
): number | null {
  const avgWith = (pct: number) =>
    computeAverage(course.categories, [
      ...course.assignments,
      { id: '__target__', name: 'target', category, score: (pct / 100) * totalPoints, totalPoints },
    ]).average ?? 0;

  let lo = 0;
  let hi = 200; // allow extra credit up to 200%
  if (avgWith(hi) < target) return null;
  if (avgWith(lo) >= target) return 0;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (avgWith(mid) >= target) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** Assignments that are flagged missing in HAC. */
export const missingAssignments = (courses: Course[]) =>
  courses.flatMap((c) => c.assignments.filter((a) => a.isMissing).map((a) => ({ course: c, assignment: a })));
