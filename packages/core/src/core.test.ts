import { describe, expect, it } from 'vitest';
import {
  bellStatus,
  computeAverage,
  computeGpa,
  requiredAssignmentScore,
  requiredExamScore,
  rotationDay,
  timeBlock,
  whatIf,
  type Course,
} from './index';

const course: Course = {
  id: 'phys',
  name: 'AP Physics',
  level: 'ap',
  credits: 1,
  reportedAverage: null,
  categories: [
    { name: 'Tests', weight: 60 },
    { name: 'Quizzes', weight: 30 },
    { name: 'Homework', weight: 10 },
  ],
  assignments: [
    { id: '1', name: 'Test 1', category: 'Tests', score: 80, totalPoints: 100 },
    { id: '2', name: 'Quiz 1', category: 'Quizzes', score: 9, totalPoints: 10 },
    { id: '3', name: 'HW 1', category: 'Homework', score: 10, totalPoints: 10 },
    { id: '4', name: 'HW 2', category: 'Homework', score: null, totalPoints: 10 },
  ],
};

describe('grades', () => {
  it('weights categories', () => {
    // 80*.6 + 90*.3 + 100*.1 = 85
    expect(computeAverage(course.categories, course.assignments).average).toBeCloseTo(85);
  });

  it('redistributes weight of empty categories', () => {
    const noTests = course.assignments.filter((a) => a.category !== 'Tests');
    // Quizzes 30/40 = 75%, HW 10/40 = 25% → 90*.75 + 100*.25 = 92.5
    const r = computeAverage(course.categories, noTests);
    expect(r.average).toBeCloseTo(92.5);
    expect(r.categories.find((c) => c.name === 'Quizzes')?.effectiveWeight).toBeCloseTo(75);
  });

  it('what-if injects mocks into their category', () => {
    const r = whatIf(course, [{ id: 'm', name: 'Test 2', category: 'Tests', score: 100, totalPoints: 100 }]);
    // Tests → 90 → 90*.6 + 27 + 10 = 91
    expect(r.after).toBeCloseTo(91);
    expect(r.delta).toBeCloseTo(6);
  });

  it('final exam formula', () => {
    // (90 - 85*0.85) / 0.15 = 118.33
    expect(requiredExamScore(85, 90, 0.15)).toBeCloseTo(118.333, 2);
  });

  it('required assignment score respects weighting', () => {
    const needed = requiredAssignmentScore(course, 'Tests', 100, 91)!;
    expect(needed).toBeCloseTo(100, 1);
  });
});

describe('gpa', () => {
  it('computes weighted and unweighted', () => {
    const r = computeGpa([
      { grade: 95, credits: 1, level: 'ap' },
      { grade: 85, credits: 1, level: 'regular' },
      { grade: 65, credits: 1, level: 'honors' }, // failing → no bonus
    ]);
    expect(r.unweighted).toBeCloseTo((4 + 3 + 1) / 3);
    expect(r.weighted).toBeCloseTo((5 + 3 + 1) / 3);
  });
});

describe('schedule', () => {
  const sched = {
    id: 'a',
    name: 'A Day',
    periods: [
      { name: '1st', start: '08:00', end: '09:30' },
      { name: '2nd', start: '09:40', end: '11:10' },
    ],
  };

  it('reports minutes left in period', () => {
    const s = bellStatus(sched, new Date(2026, 8, 28, 9, 0));
    expect(s).toMatchObject({ state: 'in_period', minutesLeft: 30 });
  });

  it('reports passing period', () => {
    expect(bellStatus(sched, new Date(2026, 8, 28, 9, 35))).toMatchObject({ state: 'passing', minutesUntil: 5 });
  });

  it('alternates A/B days skipping weekends', () => {
    const mon = new Date(2026, 8, 28); // Monday = A
    expect(rotationDay(mon, 0, new Date(2026, 8, 29), ['A', 'B'])).toBe('B');
    expect(rotationDay(mon, 0, new Date(2026, 9, 5), ['A', 'B'])).toBe('B'); // next Monday (5 school days later)
    expect(rotationDay(mon, 0, new Date(2026, 9, 3), ['A', 'B'])).toBeNull(); // Saturday
  });

  it('time-blocks tasks into free windows', () => {
    const start = new Date(2026, 8, 28, 16, 0);
    const end = new Date(2026, 8, 28, 18, 0);
    const r = timeBlock(
      [{ id: 'apush', title: 'APUSH ch.5', dueAt: '2026-09-29T08:00:00', estimatedMinutes: 50 }],
      [{ start, end }],
    );
    expect(r.blocks).toHaveLength(2);
    expect(r.unscheduled).toEqual([]);
  });
});
