import type { Assignment, Course } from '@/hac/types';

import { categoryImpact, computeAverage, letterGrade } from '../average';
import { computeGpa, detectLevel, GPA_PRESETS, gradePoints } from '../gpa';
import {
  examScoreFromSemester,
  impliedPeriodGrade,
  normalizeWeights,
  requiredExamScore,
  semesterAverage,
} from '../semester';
import { averageMismatch, solveHiddenAssignment } from '../solver';
import { requiredAssignmentScore } from '../target';
import { applyEdits, emptyEdits, whatIf } from '../whatif';

const a = (id: string, category: string, score: number | null, totalPoints = 100): Assignment => ({
  id,
  name: id,
  category,
  score,
  totalPoints,
});

/**
 * Major 60% / Daily 40%.
 * Major: 80/100 → 80.  Daily: 100, 90 → 95.  Average = 0.6·80 + 0.4·95 = 86.
 */
const course = (overrides: Partial<Course> = {}): Course => ({
  id: '3500 - 1',
  name: 'AP Physics 1',
  level: 'ap',
  credits: 1,
  reportedAverage: 86,
  categories: [
    { name: 'Major', weight: 60 },
    { name: 'Daily', weight: 40 },
  ],
  assignments: [a('test1', 'Major', 80), a('hw1', 'Daily', 100), a('hw2', 'Daily', 90)],
  ...overrides,
});

const W = { periods: [0.425, 0.425], exam: 0.15 };

describe('computeAverage', () => {
  it('weights categories', () => {
    expect(computeAverage(course().categories, course().assignments).average).toBeCloseTo(86, 10);
  });

  it('redistributes weight from empty categories', () => {
    const c = course({ assignments: [a('hw1', 'Daily', 95)] });
    const r = computeAverage(c.categories, c.assignments);
    expect(r.average).toBeCloseTo(95, 10);
    expect(r.categories.find((x) => x.name === 'Daily')?.effectiveWeight).toBeCloseTo(100, 10);
  });

  it('skips ungraded/excused work and honors per-assignment weight', () => {
    const c = course({
      assignments: [a('t1', 'Major', 80), { ...a('t2', 'Major', 100), weight: 3 }, a('t3', 'Major', null), a('hw', 'Daily', 100)],
    });
    // Major = (80 + 300) / (100 + 300) = 95
    expect(computeAverage(c.categories, c.assignments).categories[0].average).toBeCloseTo(95, 10);
  });

  it('falls back to points when no category has weight', () => {
    const r = computeAverage([], [a('x', '', 45, 50), a('y', '', 40, 50)]);
    expect(r.average).toBeCloseTo(85, 10);
  });

  it('ranks categories by points lost', () => {
    const impact = categoryImpact(computeAverage(course().categories, course().assignments));
    expect(impact[0]).toEqual({ name: 'Major', pointsLost: expect.closeTo(12, 10) });
    expect(impact[1].pointsLost).toBeCloseTo(2, 10);
  });

  it('letter grades', () => {
    expect([95, 85, 75, 65, null].map(letterGrade)).toEqual(['A', 'B', 'C', 'F', '—']);
  });
});

describe('whatIf', () => {
  it('drops, overrides and adds', () => {
    expect(whatIf(course(), { ...emptyEdits(), dropped: ['hw2'] }).average).toBeCloseTo(88, 10);
    expect(whatIf(course(), { ...emptyEdits(), overrides: { test1: 100 } }).average).toBeCloseTo(98, 10);

    const added = whatIf(course(), { ...emptyEdits(), added: [a('mock', 'Major', 100)] });
    expect(added.average).toBeCloseTo(0.6 * 90 + 0.4 * 95, 10);
    expect(added.delta).toBeCloseTo(6, 10);
  });

  it('never mutates the original assignments', () => {
    const c = course();
    applyEdits(c.assignments, { added: [], overrides: { test1: 0 }, dropped: [] });
    expect(c.assignments[0].score).toBe(80);
  });
});

describe('requiredAssignmentScore', () => {
  it('finds the score needed on the next test', () => {
    // Need Major avg (90 − 38) / 0.6 = 86.67 → (80 + s) / 2 = 86.67 → s = 93.33
    expect(requiredAssignmentScore(course(), 'Major', 100, 90)).toBeCloseTo(93.333, 2);
  });

  it('returns 0 when already safe and null when unreachable', () => {
    expect(requiredAssignmentScore(course(), 'Daily', 10, 50)).toBe(0);
    expect(requiredAssignmentScore(course(), 'Daily', 1, 99)).toBeNull();
  });
});

describe('semester math', () => {
  it('normalizes percent-style weights', () => {
    const n = normalizeWeights({ periods: [42.5, 42.5], exam: 15 });
    expect(n.periods[0]).toBeCloseTo(0.425, 10);
    expect(n.exam).toBeCloseTo(0.15, 10);
  });

  it('computes the semester average with and without an exam', () => {
    expect(semesterAverage([92, 88], 80, W)).toBeCloseTo(88.5, 10);
    expect(semesterAverage([92, 88], null, W)).toBeCloseTo(90, 10);
  });

  it('exam needed for a target honors HAC rounding', () => {
    // (89.5 − 76.5) / 0.15
    expect(requiredExamScore([92, 88], 90, W)).toBeCloseTo(86.667, 2);
    expect(requiredExamScore([92, 88], 90, W, 'none')).toBeCloseTo(90, 10);
  });

  it('works backward from a posted semester grade to a range containing the real exam', () => {
    // Real exam 84 → semester 89.1 → HAC shows 89.
    const r = examScoreFromSemester([92, 88], 89, W, { periodRounding: 'none' });
    expect(r.estimate).toBeCloseTo(83.333, 2);
    expect(r.min).toBeCloseTo(80, 10);
    expect(r.max).toBeCloseTo(86.667, 2);
    expect(r.min).toBeLessThanOrEqual(84);
    expect(r.max).toBeGreaterThanOrEqual(84);
    expect(r.plausible).toBe(true);
  });

  it('widens the range when period grades are rounded too', () => {
    const exact = examScoreFromSemester([92, 88], 89, W, { periodRounding: 'none' });
    const rounded = examScoreFromSemester([92, 88], 89, W, { periodRounding: 'whole' });
    expect(rounded.max - rounded.min).toBeGreaterThan(exact.max - exact.min);
  });

  it('flags impossible results (a hidden grade or wrong weights)', () => {
    expect(examScoreFromSemester([70, 70], 95, W).plausible).toBe(false);
  });

  it('solves for a grading period the teacher folded the exam into', () => {
    const r = impliedPeriodGrade([92, null], 89, 84, W, { periodRounding: 'none' });
    expect(r.estimate).toBeCloseTo((89 - 51.7) / 0.425, 6);
    expect(r.min).toBeCloseTo((88.5 - 51.7) / 0.425, 6);

    // No separate exam: the exam weight is spread over the periods (50/50 here).
    const noExam = impliedPeriodGrade([92, null], 90, null, W, { periodRounding: 'none' });
    expect(noExam.estimate).toBeCloseTo(88, 10);
    expect([noExam.min, noExam.max]).toEqual([expect.closeTo(87, 10), expect.closeTo(89, 10)]);
  });

  it('rejects mismatched inputs', () => {
    expect(() => semesterAverage([90], 90, W)).toThrow(RangeError);
    expect(() => impliedPeriodGrade([null, null], 90, null, W)).toThrow(RangeError);
    expect(() => requiredExamScore([90, 90], 90, { periods: [0.5, 0.5], exam: 0 })).toThrow(RangeError);
  });
});

describe('solveHiddenAssignment', () => {
  it('recovers a hidden test score from the posted average', () => {
    // Hidden Major test of 95 → Major (80 + 95) / 200 = 87.5 → average 0.6·87.5 + 38 = 90.5
    const r = solveHiddenAssignment(course(), { category: 'Major' }, 90.5);
    expect(r.estimate).toBeCloseTo(95, 4);
    expect(r.min).toBeLessThanOrEqual(95);
    expect(r.max).toBeGreaterThanOrEqual(95);
    expect(r.max - r.min).toBeLessThan(0.05);
    expect(r.plausible).toBe(true);
  });

  it('handles a hidden grade that is the first in its category', () => {
    const c = course({ assignments: [a('hw1', 'Daily', 95)] });
    // avg = 0.6·s + 0.4·95 → s = (89 − 38) / 0.6 = 85
    expect(solveHiddenAssignment(c, { category: 'Major' }, 89).estimate).toBeCloseTo(85, 4);
  });

  it('respects point value and weight', () => {
    // A 50-point exam counted 2× scoring 45 (90%) → Major (80 + 90) / (100 + 100) = 85 → 0.6·85 + 38 = 89
    const r = solveHiddenAssignment(course(), { category: 'Major', totalPoints: 50, weight: 2 }, 89);
    expect(r.estimate).toBeCloseTo(90, 4);
  });

  it('gives a wide range when the posted grade is a whole number', () => {
    const r = solveHiddenAssignment(course(), { category: 'Major' }, 90, 'whole');
    expect(r.max - r.min).toBeGreaterThan(1);
  });

  it('flags averages no score can explain', () => {
    expect(solveHiddenAssignment(course(), { category: 'Major' }, 99).plausible).toBe(false);
    expect(solveHiddenAssignment(course(), { category: 'Major' }, 50).plausible).toBe(false);
  });

  it('detects when the posted average does not match visible work', () => {
    expect(averageMismatch(course())).toBe(0);
    expect(averageMismatch(course({ reportedAverage: 90.5 }))).toBeCloseTo(4.5, 10);
  });

  it('rejects unknown categories', () => {
    expect(() => solveHiddenAssignment(course(), { category: 'Labs' }, 90)).toThrow(RangeError);
  });
});

describe('gpa', () => {
  const letter = GPA_PRESETS['letter-4'].scale;
  const linear = GPA_PRESETS['linear-6'].scale;

  it('letter scale with level bonus', () => {
    expect(gradePoints(95, 'ap', letter, true)).toBe(5);
    expect(gradePoints(95, 'ap', letter, false)).toBe(4);
    expect(gradePoints(85, 'honors', letter, true)).toBe(3.5);
    expect(gradePoints(65, 'ap', letter, true)).toBe(0);
  });

  it('linear scale', () => {
    expect(gradePoints(95, 'ap', linear, true)).toBeCloseTo(5.5, 10);
    expect(gradePoints(100, 'regular', linear, true)).toBe(4);
    expect(gradePoints(72, 'honors', linear, true)).toBeCloseTo(2.2, 10);
  });

  it('credit-weighted GPA', () => {
    const r = computeGpa(
      [
        { grade: 95, credits: 1, level: 'ap' },
        { grade: 85, credits: 1, level: 'regular' },
      ],
      letter,
    );
    expect(r).toEqual({ credits: 2, unweighted: 3.5, weighted: 4 });
    expect(computeGpa([], letter).weighted).toBeNull();
  });

  it('detects course level from the name', () => {
    expect(detectLevel('AP Physics 1')).toBe('ap');
    expect(detectLevel('English II H')).toBe('honors');
    expect(detectLevel('PAP Chemistry')).toBe('honors');
    expect(detectLevel('Algebra I')).toBe('regular');
    expect(detectLevel('Hospitality Services')).toBe('regular');
  });
});
