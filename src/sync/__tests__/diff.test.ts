import type { Course } from '@/hac/types';

import { describeChange, diffSnapshots } from '../diff';

const course = (assignments: Course['assignments'], reportedAverage: number | null = 90): Course => ({
  id: '3500 - 1',
  name: 'AP Physics 1',
  level: 'ap',
  credits: 1,
  reportedAverage,
  categories: [{ name: 'Major', weight: 100 }],
  assignments,
});

const asg = (id: string, score: number | null) => ({ id, name: id, category: 'Major', score, totalPoints: 100 });

describe('diffSnapshots', () => {
  it('reports newly posted, changed and average changes', () => {
    const before = [course([asg('test1', 80), asg('test2', null)], 80)];
    const after = [course([asg('test1', 85), asg('test2', 90), asg('test3', 100)], 91.67)];
    expect(diffSnapshots(before, after).map((c) => c.kind)).toEqual([
      'grade-changed',
      'new-grade',
      'new-grade',
      'average-changed',
    ]);
  });

  it('is quiet when nothing changed or the course is new', () => {
    const snap = [course([asg('test1', 80)])];
    expect(diffSnapshots(snap, snap)).toEqual([]);
    expect(diffSnapshots([], snap)).toEqual([]);
  });

  it('describes changes for notifications', () => {
    const [change] = diffSnapshots([course([])], [course([asg('Unit 2 Test', 92)])]);
    expect(describeChange(change)).toEqual({ title: 'New grade in AP Physics 1', body: 'Unit 2 Test: 92/100' });
  });
});
