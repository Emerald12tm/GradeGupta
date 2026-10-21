import type { Assignment, Course } from '@/hac/types';

import { computeAverage } from './average';
import { roundingHalfWidth, type Rounding, type ScoreRange } from './semester';

/**
 * Hidden assignment solver.
 *
 * Some teachers enter a grade (often the final exam) that changes the posted average before
 * the assignment itself shows up, or they fold the exam into a grading period. If you know
 * the posted average and roughly what the hidden grade was (its category and point value),
 * there's only one score that makes the math work. This finds it.
 *
 * The class average only goes up as the hidden score goes up, so a simple bisection
 * search finds the score for any target average, and it handles category weighting and
 * empty-category redistribution exactly.
 */

export interface HiddenAssignmentSpec {
  /** Category the hidden grade was entered in, e.g. "Major Grades". */
  category: string;
  /** Points it's out of. Defaults to 100. */
  totalPoints?: number;
  /** HAC per-assignment weight (some teachers count exams 2×). Defaults to 1. */
  weight?: number;
}

/** Highest percent we'll consider, to allow for extra credit. */
const MAX_PERCENT = 200;

/** Class average when the hidden assignment scores `percent`. */
function averageWith(course: Course, spec: HiddenAssignmentSpec, percent: number): number {
  const total = spec.totalPoints ?? 100;
  const hidden: Assignment = {
    id: '__hidden__',
    name: 'Hidden grade',
    category: spec.category,
    score: (percent / 100) * total,
    totalPoints: total,
    weight: spec.weight ?? 1,
  };
  return computeAverage(course.categories, [...course.assignments, hidden]).average ?? 0;
}

/**
 * Smallest percent in [0, MAX_PERCENT] whose average reaches `target`.
 * Returns -Infinity / +Infinity when the target is below or above what's reachable.
 */
function solveFor(course: Course, spec: HiddenAssignmentSpec, target: number): number {
  if (averageWith(course, spec, 0) >= target) return -Infinity;
  if (averageWith(course, spec, MAX_PERCENT) < target) return Infinity;
  let lo = 0;
  let hi = MAX_PERCENT;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (averageWith(course, spec, mid) >= target) hi = mid;
    else lo = mid;
  }
  return hi;
}

/**
 * The score (as a percent of the hidden assignment's points) that explains a posted average.
 *
 * @param course the course with only the assignments you can see.
 * @param postedAverage the average HAC now shows (class average, or a grading-period grade
 *   from `impliedPeriodGrade`).
 * @param rounding how `postedAverage` is rounded: 'hundredth' on the Assignments page,
 *   'whole' on the report card.
 */
export function solveHiddenAssignment(
  course: Course,
  spec: HiddenAssignmentSpec,
  postedAverage: number,
  rounding: Rounding = 'hundredth',
): ScoreRange {
  if (!course.categories.some((c) => c.name === spec.category) && course.categories.length > 0) {
    throw new RangeError(`"${spec.category}" isn't one of this course's categories`);
  }
  const h = roundingHalfWidth(rounding);
  const estimate = solveFor(course, spec, postedAverage);
  const min = solveFor(course, spec, postedAverage - h);
  // Upper edge is exclusive, so back off a hair to stay inside the rounding interval.
  const max = h > 0 ? solveFor(course, spec, postedAverage + h - 1e-9) : estimate;
  return {
    estimate,
    min: Math.max(min, 0),
    max: Math.min(max, MAX_PERCENT),
    plausible: Number.isFinite(estimate) && estimate <= 100,
  };
}

/**
 * Difference between the average HAC reports and the average its visible assignments produce.
 * A gap bigger than rounding noise suggests a hidden grade, which is when the UI offers the solver.
 */
export function averageMismatch(course: Course): number | null {
  if (course.reportedAverage === null) return null;
  const computed = computeAverage(course.categories, course.assignments).average;
  if (computed === null) return null;
  const gap = course.reportedAverage - computed;
  return Math.abs(gap) < 0.02 ? 0 : gap;
}
