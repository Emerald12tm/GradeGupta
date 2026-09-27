import type { CourseLevel } from './types';

/**
 * Districts differ, so every value here is user-editable and stored per student in Supabase.
 * `cutoffs` maps a minimum percent to base grade points (checked top-down).
 * `levelBonus` is added for weighted GPA when the grade is passing.
 */
export interface GpaScale {
  cutoffs: { min: number; points: number }[];
  levelBonus: Record<CourseLevel, number>;
  passingPercent: number;
}

export const DEFAULT_GPA_SCALE: GpaScale = {
  cutoffs: [
    { min: 90, points: 4 },
    { min: 80, points: 3 },
    { min: 70, points: 2 },
    { min: 60, points: 1 },
    { min: 0, points: 0 },
  ],
  levelBonus: { regular: 0, honors: 0.5, ap: 1, ib: 1, dual_credit: 1 },
  passingPercent: 70,
};

export interface GpaInput {
  grade: number; // percent
  credits: number;
  level: CourseLevel;
}

export function gradePoints(percent: number, level: CourseLevel, scale: GpaScale, weighted: boolean): number {
  const base = scale.cutoffs.find((c) => percent >= c.min)?.points ?? 0;
  if (!weighted || percent < scale.passingPercent) return base;
  return base + scale.levelBonus[level];
}

/** GPA = Σ(grade points × credits) / Σ credits attempted. */
export function computeGpa(courses: GpaInput[], scale: GpaScale = DEFAULT_GPA_SCALE) {
  let credits = 0;
  let unweighted = 0;
  let weighted = 0;
  for (const c of courses) {
    credits += c.credits;
    unweighted += gradePoints(c.grade, c.level, scale, false) * c.credits;
    weighted += gradePoints(c.grade, c.level, scale, true) * c.credits;
  }
  return {
    credits,
    unweighted: credits ? unweighted / credits : null,
    weighted: credits ? weighted / credits : null,
  };
}
