import type { Course } from '@/hac/types';
import { DEFAULT_SETTINGS, migrate } from '@/settings/settings';

import { diffSnapshots } from '../diff';
import { crossedBelow, currentGpa, selectNotifications } from '../sync';

// sync.ts imports native modules (SQLite, notifications); these tests only use its pure helpers.
jest.mock('@/storage/db', () => ({}));
jest.mock('../notifications', () => ({ notify: jest.fn() }));

const course = (id: string, avg: number | null, scores: number[] = []): Course => ({
  id,
  name: `Course ${id}`,
  level: 'regular',
  credits: 1,
  reportedAverage: avg,
  categories: [{ name: 'Major', weight: 100 }],
  assignments: scores.map((s, i) => ({ id: `${id}-${i}`, name: `Test ${i + 1}`, category: 'Major', score: s, totalPoints: 100 })),
});

describe('crossedBelow', () => {
  it('only reports courses that just dropped under the line', () => {
    const before = [course('a', 85), course('b', 75), course('c', 90)];
    const after = [course('a', 79), course('b', 74), course('c', 88)];
    expect(crossedBelow(before, after, 80).map((c) => c.id)).toEqual(['a']);
  });
});

describe('selectNotifications', () => {
  const before = [course('a', 90, [90])];
  const after = [course('a', 85, [90, 80])];
  const changes = diffSnapshots(before, after);

  it('notifies new grades by default, not average moves', () => {
    expect(selectNotifications(changes, before, after, DEFAULT_SETTINGS)).toEqual([
      { title: 'New grade in Course a', body: 'Test 2: 80/100' },
    ]);
  });

  it('honors the minimum average change and the low grade alert', () => {
    const settings = { ...DEFAULT_SETTINGS, notifyGrades: false, notifyAverages: true, minAverageChange: 10, lowGradeAlert: 88 };
    expect(selectNotifications(changes, before, after, settings)).toEqual([
      { title: 'Course a is below 88', body: 'Your average is now 85.00.' },
    ]);
  });

  it('bundles many updates into one summary', () => {
    const many = [course('a', 90, []), course('b', 90, [])];
    const posted = [course('a', 90, [1, 2, 3]), course('b', 90, [4])];
    const result = selectNotifications(diffSnapshots(many, posted), many, posted, DEFAULT_SETTINGS);
    expect(result).toEqual([{ title: '4 grade updates', body: 'Course a, Course b' }]);
  });
});

describe('goal alerts', () => {
  it('notifies once when a class drops below its goal', () => {
    const settings = { ...DEFAULT_SETTINGS, notifyGrades: false, courseOverrides: { 'Course a': { goal: 90 } } };
    const before = [course('a', 91)];
    const after = [course('a', 89.5)];
    expect(selectNotifications([], before, after, settings)).toEqual([
      { title: 'Course a slipped below your goal', body: 'Now 89.50 (goal 90).' },
    ]);
    expect(selectNotifications([], after, after, settings)).toEqual([]);
  });
});

describe('settings migration', () => {
  it('moves the old 15% default final weight to 20%, but keeps other choices', () => {
    expect(migrate({ ...DEFAULT_SETTINGS, version: 1, semesterPreset: '2x42.5+15' }).semesterPreset).toBe('2x40+20');
    expect(migrate({ ...DEFAULT_SETTINGS, version: 1, semesterPreset: '2x45+10' }).semesterPreset).toBe('2x45+10');
    expect(migrate({ ...DEFAULT_SETTINGS, version: 2, semesterPreset: '2x42.5+15' }).semesterPreset).toBe('2x42.5+15');
    expect(DEFAULT_SETTINGS.semesterPreset).toBe('2x40+20');
  });
});

describe('currentGpa', () => {
  it('skips courses excluded from GPA', () => {
    const settings = { ...DEFAULT_SETTINGS, courseOverrides: { 'Course b': { excludeFromGpa: true } } };
    expect(currentGpa([course('a', 95), course('b', 50)], settings).unweighted).toBe(4);
  });
});
