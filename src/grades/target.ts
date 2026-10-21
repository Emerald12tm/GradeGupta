import type { Course } from '@/hac/types';

import { computeAverage } from './average';

/**
 * "What do I need?": the score on one upcoming assignment that brings the class average
 * to `target`.
 *
 * Uses bisection over the score so category weights and empty-category redistribution
 * are respected exactly (a new category's first grade can swing the average a lot).
 *
 * @returns percent needed (0–200), 0 if you're already there no matter what, or `null`
 *   if even 200% wouldn't get there.
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
      { id: '__target__', name: 'Next assignment', category, score: (pct / 100) * totalPoints, totalPoints },
    ]).average ?? 0;

  let lo = 0;
  let hi = 200;
  if (avgWith(hi) < target) return null;
  if (avgWith(lo) >= target) return 0;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (avgWith(mid) >= target) hi = mid;
    else lo = mid;
  }
  return hi;
}
