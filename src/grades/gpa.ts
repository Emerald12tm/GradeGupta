import type { CourseLevel } from '@/hac/types';

/**
 * GPA calculation with district-configurable scales.
 *
 * Districts disagree a lot here, so two scale shapes are supported and every number is
 * editable in Settings:
 *
 * - `letter`: percent cutoffs map to base points (A=4, B=3, …) plus a bonus per course level.
 * - `linear`: a top grade earns the level's max points and each percentage point below it
 *   subtracts `perPoint` (common in Texas, e.g. AP 100 → 6.0, 95 → 5.5).
 *
 * GPA = Σ(points × credits) / Σ credits.
 */

export type GpaScale =
  | {
      kind: 'letter';
      cutoffs: { min: number; points: number }[];
      levelBonus: Record<CourseLevel, number>;
      passingPercent: number;
    }
  | {
      kind: 'linear';
      /** Points for a grade of `topPercent` or higher, per course level. */
      maxPoints: Record<CourseLevel, number>;
      topPercent: number;
      perPoint: number;
      passingPercent: number;
    };

export const GPA_PRESETS: Record<string, { label: string; scale: GpaScale }> = {
  'letter-4': {
    label: '4.0 letter scale (Honors +0.5, AP/IB/DC +1)',
    scale: {
      kind: 'letter',
      cutoffs: [
        { min: 90, points: 4 },
        { min: 80, points: 3 },
        { min: 70, points: 2 },
        { min: 0, points: 0 },
      ],
      levelBonus: { regular: 0, honors: 0.5, ap: 1, ib: 1, dual_credit: 1 },
      passingPercent: 70,
    },
  },
  'linear-6': {
    label: 'Linear 6.0 (Regular 4 / Honors 5 / AP 6, −0.1 per point)',
    scale: {
      kind: 'linear',
      maxPoints: { regular: 4, honors: 5, ap: 6, ib: 6, dual_credit: 6 },
      topPercent: 100,
      perPoint: 0.1,
      passingPercent: 70,
    },
  },
  'linear-5': {
    label: 'Linear 5.0 (Regular 4 / Honors 4.5 / AP 5, −0.1 per point)',
    scale: {
      kind: 'linear',
      maxPoints: { regular: 4, honors: 4.5, ap: 5, ib: 5, dual_credit: 5 },
      topPercent: 100,
      perPoint: 0.1,
      passingPercent: 70,
    },
  },
};

export const DEFAULT_GPA_PRESET = 'letter-4';

/** Grade points for one course. `weighted: false` treats every course as regular. */
export function gradePoints(percent: number, level: CourseLevel, scale: GpaScale, weighted: boolean): number {
  const lvl: CourseLevel = weighted ? level : 'regular';
  if (percent < scale.passingPercent) return 0;
  if (scale.kind === 'letter') {
    const base = scale.cutoffs.find((c) => percent >= c.min)?.points ?? 0;
    return base + scale.levelBonus[lvl];
  }
  const below = Math.max(0, scale.topPercent - percent);
  return Math.max(0, scale.maxPoints[lvl] - below * scale.perPoint);
}

export interface GpaInput {
  /** Percent grade. */
  grade: number;
  credits: number;
  level: CourseLevel;
}

export interface GpaResult {
  credits: number;
  unweighted: number | null;
  weighted: number | null;
}

export function computeGpa(courses: GpaInput[], scale: GpaScale): GpaResult {
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

/** Guesses rigor from the course name ("AP Physics 1", "English 2 Honors", "PAP Chem"). */
export function detectLevel(name: string): CourseLevel {
  const n = ` ${name.toUpperCase()} `;
  if (/\bAP\b/.test(n)) return 'ap';
  if (/\bIB\b/.test(n)) return 'ib';
  if (/\b(DC|DUAL)\b/.test(n)) return 'dual_credit';
  if (/\b(H|HON|HONORS|PAP|PREAP|GT|ADV|ADVANCED)\b/.test(n)) return 'honors';
  return 'regular';
}
