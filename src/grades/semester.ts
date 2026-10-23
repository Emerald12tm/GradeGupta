/**
 * Semester grade and final exam math.
 *
 * Most Texas districts compute a semester grade as a weighted mix of the grading-period
 * averages and the final exam, for example:
 *
 *   Semester = 0.425 × Q1 + 0.425 × Q2 + 0.15 × Exam
 *
 * Every function here takes the weights explicitly so any district's formula works.
 *
 * HAC shows semester grades as whole numbers, so a posted "90" really means
 * "somewhere in [89.5, 90.5)". When we work backward from a posted grade we return a
 * range, not a single number, and say so in the UI.
 */

export interface SemesterWeights {
  /** Weight of each grading period, as fractions (e.g. [0.425, 0.425]). */
  periods: number[];
  /** Weight of the final exam as a fraction (e.g. 0.15). 0 for exam-exempt formulas. */
  exam: number;
}

export interface SemesterPreset extends SemesterWeights {
  id: string;
  label: string;
}

/** Common district formulas; the first is the default. Users can also enter custom weights. */
export const SEMESTER_PRESETS: SemesterPreset[] = [
  { id: '2x40+20', label: '2 grading periods 40% each + final 20%', periods: [0.4, 0.4], exam: 0.2 },
  { id: '2x42.5+15', label: '2 grading periods 42.5% each + final 15%', periods: [0.425, 0.425], exam: 0.15 },
  { id: '2x45+10', label: '2 grading periods 45% each + exam 10%', periods: [0.45, 0.45], exam: 0.1 },
  { id: '3x28.33+15', label: '3 six-weeks 28.33% each + exam 15%', periods: [0.85 / 3, 0.85 / 3, 0.85 / 3], exam: 0.15 },
  { id: '3x26.67+20', label: '3 six-weeks 26.67% each + exam 20%', periods: [0.8 / 3, 0.8 / 3, 0.8 / 3], exam: 0.2 },
];

/** How a displayed grade was rounded. Determines how wide the uncertainty range is. */
export type Rounding = 'none' | 'hundredth' | 'whole';

/** Half the width of the interval a rounded number could have come from. */
export const roundingHalfWidth = (r: Rounding): number => (r === 'whole' ? 0.5 : r === 'hundredth' ? 0.005 : 0);

/** Scales weights so they sum to 1 (lets users type 42.5/42.5/15 or 0.425/0.425/0.15). */
export function normalizeWeights(w: SemesterWeights): SemesterWeights {
  const total = w.periods.reduce((s, p) => s + p, 0) + w.exam;
  if (total <= 0) throw new RangeError('Semester weights must add up to more than 0');
  return { periods: w.periods.map((p) => p / total), exam: w.exam / total };
}

const dot = (weights: number[], values: number[]) => weights.reduce((s, w, i) => s + w * values[i], 0);

function assertPeriodCount(grades: unknown[], w: SemesterWeights) {
  if (grades.length !== w.periods.length) {
    throw new RangeError(`Expected ${w.periods.length} grading-period grades, got ${grades.length}`);
  }
}

/**
 * Semester average. With `exam === null` (exam not taken yet or exempt), the exam weight
 * is spread across the grading periods, which is how HAC shows an in-progress semester.
 */
export function semesterAverage(periodGrades: number[], exam: number | null, weights: SemesterWeights): number {
  const w = normalizeWeights(weights);
  assertPeriodCount(periodGrades, w);
  if (exam === null || w.exam === 0) {
    const periodTotal = w.periods.reduce((s, p) => s + p, 0);
    return dot(w.periods, periodGrades) / periodTotal;
  }
  return dot(w.periods, periodGrades) + w.exam * exam;
}

/**
 * Exam score needed to finish the semester at `target` or better.
 *
 * With `semesterRounding: 'whole'` (the default) a target of 90 only requires 89.5, because
 * HAC rounds the semester grade up from .5. The result can be below 0 (you're safe no matter
 * what) or above 100 (out of reach); the UI explains both cases.
 */
export function requiredExamScore(
  periodGrades: number[],
  target: number,
  weights: SemesterWeights,
  semesterRounding: Rounding = 'whole',
): number {
  const w = normalizeWeights(weights);
  assertPeriodCount(periodGrades, w);
  if (w.exam === 0) throw new RangeError('This formula has no exam weight');
  return (target - roundingHalfWidth(semesterRounding) - dot(w.periods, periodGrades)) / w.exam;
}

export interface ScoreRange {
  /** Best single guess: the value you'd get if every displayed number were exact. */
  estimate: number;
  min: number;
  max: number;
  /**
   * False when no score from 0 to 100 can explain the posted grade. That usually means the
   * teacher counted something we can't see (see `solver.ts`), or the weights are wrong.
   */
  plausible: boolean;
}

export interface BackSolveOptions {
  /** How the posted semester grade is rounded. HAC report cards: 'whole'. */
  semesterRounding?: Rounding;
  /** How the grading-period grades you entered are rounded. 'hundredth' if copied from Assignments. */
  periodRounding?: Rounding;
}

function rangeFrom(estimate: number, min: number, max: number): ScoreRange {
  return { estimate, min, max, plausible: max >= 0 && min <= 100 };
}

/**
 * Works backward from a posted semester grade to the final exam score you must have made.
 *
 *   Exam = (Semester − Σ wᵢ·Qᵢ) / w_exam
 *
 * The range accounts for rounding in both the semester grade and the period grades.
 */
export function examScoreFromSemester(
  periodGrades: number[],
  postedSemester: number,
  weights: SemesterWeights,
  options: BackSolveOptions = {},
): ScoreRange {
  const w = normalizeWeights(weights);
  assertPeriodCount(periodGrades, w);
  if (w.exam === 0) throw new RangeError('This formula has no exam weight');

  const hs = roundingHalfWidth(options.semesterRounding ?? 'whole');
  const hp = roundingHalfWidth(options.periodRounding ?? 'hundredth');
  const periodSum = dot(w.periods, periodGrades);
  const periodSlack = hp * w.periods.reduce((s, p) => s + p, 0);

  return rangeFrom(
    (postedSemester - periodSum) / w.exam,
    (postedSemester - hs - periodSum - periodSlack) / w.exam,
    (postedSemester + hs - periodSum + periodSlack) / w.exam,
  );
}

/**
 * For teachers who fold the final exam (or other late grades) into a grading period instead
 * of a separate exam column: given the posted semester grade, the other periods, and the
 * exam if it has its own column, returns what the unknown period's grade must have been.
 *
 * Feed the result into `solveHiddenAssignment` (solver.ts) to recover the test score itself.
 *
 * @param periodGrades grading-period grades with exactly one `null` for the unknown period.
 */
export function impliedPeriodGrade(
  periodGrades: (number | null)[],
  postedSemester: number,
  exam: number | null,
  weights: SemesterWeights,
  options: BackSolveOptions = {},
): ScoreRange {
  const w = normalizeWeights(weights);
  assertPeriodCount(periodGrades, w);
  const unknown = periodGrades.indexOf(null);
  if (unknown === -1 || periodGrades.lastIndexOf(null) !== unknown) {
    throw new RangeError('Leave exactly one grading period blank');
  }

  // With no exam score, the exam weight is spread across periods, as in semesterAverage.
  const useExam = exam !== null && w.exam > 0;
  const scale = useExam ? 1 : 1 / w.periods.reduce((s, p) => s + p, 0);
  const wu = w.periods[unknown] * scale;
  const hs = roundingHalfWidth(options.semesterRounding ?? 'whole');
  const hp = roundingHalfWidth(options.periodRounding ?? 'hundredth');

  let known = useExam ? w.exam * (exam as number) : 0;
  let knownSlack = 0;
  periodGrades.forEach((g, i) => {
    if (i === unknown) return;
    known += w.periods[i] * scale * (g as number);
    knownSlack += w.periods[i] * scale * hp;
  });

  return rangeFrom(
    (postedSemester - known) / wu,
    (postedSemester - hs - known - knownSlack) / wu,
    (postedSemester + hs - known + knownSlack) / wu,
  );
}
