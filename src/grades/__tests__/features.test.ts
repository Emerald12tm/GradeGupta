import type { Assignment, Course } from '@/hac/types';
import { buildDigest, shouldSendDigest, weekKey } from '@/sync/digest';
import { makeBackup, parseBackup } from '@/storage/backup';
import { escapeHtml, gradeReportHtml, teacherMailto } from '@/integrations/report';

import { summarizeAttendance } from '../attendance';
import { GPA_PRESETS } from '../gpa';
import { finalsPlan, goalStatus, projectGpa } from '../planning';
import { studyTips } from '../tips';

const a = (id: string, category: string, score: number | null, totalPoints = 100, extra: Partial<Assignment> = {}): Assignment => ({
  id,
  name: id,
  category,
  score,
  totalPoints,
  ...extra,
});

/** Major 60 / Minor 40. Major 80, Minor (100 + 90) / 200 = 95 → 86. */
const course = (overrides: Partial<Course> = {}): Course => ({
  id: 'C1',
  name: 'AP Physics',
  level: 'ap',
  credits: 1,
  reportedAverage: 86,
  categories: [
    { name: 'Major', weight: 60 },
    { name: 'Minor', weight: 40 },
  ],
  assignments: [a('test', 'Major', 80), a('hw1', 'Minor', 100), a('hw2', 'Minor', 90)],
  ...overrides,
});

const letter = GPA_PRESETS['letter-4'].scale;

describe('GPA planner', () => {
  it('projects GPA from the grades you plan to finish with', () => {
    const courses = [course(), course({ id: 'C2', name: 'History', level: 'regular', reportedAverage: 79 })];
    const r = projectGpa(courses, { C2: 91 }, letter);
    // Now: AP 86 → 3+1 = 4, regular 79 → 2 → weighted 3.0. Planned: regular 91 → 4 → weighted (4 + 4) / 2 = 4.0
    expect(r.current.weighted).toBe(3);
    expect(r.projected.weighted).toBe(4);
    // Leaving History out of GPA leaves only the AP class.
    expect(projectGpa(courses, {}, letter, (c) => c.id === 'C2').current.weighted).toBe(4);
  });
});

describe('goals', () => {
  it('reports the gap and the score needed on the next major grade', () => {
    const g = goalStatus(course(), 90)!;
    expect(g.met).toBe(false);
    expect(g.gap).toBeCloseTo(-4, 10);
    expect(g.category).toBe('Major');
    // Major must reach (90 − 38) / 0.6 = 86.67 → (80 + s) / 2 → s = 93.3
    expect(g.nextNeeded).toBeCloseTo(93.33, 1);
    expect(goalStatus(course(), 85)!.met).toBe(true);
    expect(goalStatus(course({ reportedAverage: null }), 90)).toBeNull();
  });
});

describe('final exam planner', () => {
  const W = { periods: [0.4, 0.4], exam: 0.2 };
  const card = {
    headers: ['Course', 'Description', '1st', '2nd', 'EXM1', 'SEM1'],
    rows: [
      { Course: 'C1', Description: 'AP Physics', '1st': '92', '2nd': '88', EXM1: '', SEM1: '' },
      { Course: 'C2', Description: 'History', '1st': '85', '2nd': '', EXM1: '', SEM1: '' },
      { Course: 'C3', Description: 'Done Class', '1st': '90', '2nd': '90', EXM1: '90', SEM1: '90' },
    ],
  };

  it('computes the exam needed for each letter, using live averages for unposted periods', () => {
    const plans = finalsPlan(card, W, { history: 81 });
    expect(plans.map((p) => p.course)).toEqual(['AP Physics', 'History']);
    // (89.5 − 0.4·92 − 0.4·88) / 0.2 = 87.5
    expect(plans[0].needFor.A).toBeCloseTo(87.5, 6);
    expect(plans[1].periods).toEqual([
      { grade: 85, estimated: false },
      { grade: 81, estimated: true },
    ]);
  });

  it('skips classes with nothing to go on', () => {
    expect(finalsPlan(card, W).map((p) => p.course)).toEqual(['AP Physics']);
  });
});

describe('study tips', () => {
  it('points out missing work, the weakest category and the next big assignment', () => {
    const c = course({
      assignments: [
        a('test', 'Major', 80),
        a('hw1', 'Minor', 100),
        a('Late lab', 'Minor', 0, 100, { isMissing: true }),
        a('Unit 2 Test', 'Major', null, 100, { dateDue: '2099-01-01' }),
      ],
    });
    const tips = studyTips(c, '2026-10-22');
    expect(tips.map((t) => t.kind)).toEqual(expect.arrayContaining(['missing', 'category', 'upcoming']));
    expect(tips.find((t) => t.kind === 'missing')!.text).toContain('Late lab');
    // Sorted by points at stake, biggest first.
    expect(tips.map((t) => t.points)).toEqual([...tips.map((t) => t.points)].sort((x, y) => y - x));
  });

  it('says when you are close to the next letter', () => {
    const c = course({ assignments: [a('t', 'Major', 89), a('h', 'Minor', 89)] });
    expect(studyTips(c).find((t) => t.kind === 'close')?.text).toBe('You’re 1.0 point from 90.');
  });
});

describe('attendance summary', () => {
  it('counts events by type', () => {
    expect(
      summarizeAttendance([
        { date: '2026-10-02', events: ['Tardy', 'Period 1'] },
        { date: '2026-10-05', events: ['Tardy'] },
        { date: '2026-10-09', events: ['Excused Absence'] },
      ]),
    ).toEqual([
      { type: 'Tardy', count: 2 },
      { type: 'Excused Absence', count: 1 },
    ]);
  });
});

describe('weekly digest', () => {
  it('sends once on Sunday evening', () => {
    const sundayEvening = new Date(2026, 9, 25, 18, 0); // Sun Oct 25 2026, 6pm local
    expect(weekKey(sundayEvening)).toBe('2026-10-25');
    expect(weekKey(new Date(2026, 9, 28))).toBe('2026-10-25');
    expect(shouldSendDigest(sundayEvening, null)).toBe(true);
    expect(shouldSendDigest(sundayEvening, '2026-10-25')).toBe(false);
    expect(shouldSendDigest(new Date(2026, 9, 25, 9, 0), null)).toBe(false);
    expect(shouldSendDigest(new Date(2026, 9, 26, 18, 0), null)).toBe(false);
  });

  it('summarizes changes, missing work and what is due', () => {
    const now = new Date('2026-10-25T23:00:00Z');
    const c = course({ reportedAverage: 88, assignments: [a('m', 'Minor', 0, 10, { isMissing: true }), a('next', 'Major', null, 100, { dateDue: '2026-10-28' })] });
    const history = [{ courseId: 'C1', courseName: 'AP Physics', takenAt: '2026-10-10T00:00:00Z', average: 86 }];
    expect(buildDigest([c], history, now)).toEqual({
      title: 'Your week in grades',
      body: 'AP Physics ▲2.0 · 1 missing · 1 due this week',
    });
  });
});

describe('backup', () => {
  it('round-trips and never includes reminder ids', () => {
    const b = makeBackup({
      snapshots: [{ markingPeriod: 'current', takenAt: '2026-10-22T00:00:00Z', courses: [course()] }],
      courseHistory: [],
      gpaHistory: [],
      todos: [{ id: 1, title: 'Study', due: null, courseId: null, done: false, notificationId: 'abc' }] as never,
    });
    const text = JSON.stringify(b);
    expect(text).not.toContain('abc');
    expect(parseBackup(text).snapshots[0].courses[0].name).toBe('AP Physics');
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('hello')).toThrow('isn’t a GradeGupta backup');
    expect(() => parseBackup('{"app":"Other"}')).toThrow('isn’t a GradeGupta backup');
    expect(() => parseBackup('{"app":"GradeGupta","version":99}')).toThrow('newer version');
    expect(() => parseBackup('{"app":"GradeGupta","version":1}')).toThrow('damaged');
  });
});

describe('report and email', () => {
  it('escapes HAC text in the PDF', () => {
    const html = gradeReportHtml({
      student: 'Alex <script>',
      courses: [course({ name: 'Art & <b>Design</b>' })],
      gpa: { credits: 1, weighted: 4, unweighted: 3 },
      generatedAt: new Date('2026-10-22T12:00:00Z'),
    });
    expect(html).toContain('Art &amp; &lt;b&gt;Design&lt;/b&gt;');
    expect(html).not.toContain('<script>');
    expect(escapeHtml(`"'`)).toBe('&quot;&#39;');
  });

  it('builds an encoded mailto link', () => {
    expect(teacherMailto('t@school.org', 'AP Stats', 'Unit 3 & 4')).toBe(
      'mailto:t@school.org?subject=AP%20Stats%3A%20Unit%203%20%26%204&body=' +
        encodeURIComponent('Hi,\n\nI have a question about "Unit 3 & 4" in AP Stats.\n\nThank you,'),
    );
  });
});
