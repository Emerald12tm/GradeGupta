import { computeAverage } from '@/grades/average';
import type {
  Assignment,
  AssignmentsPage,
  AttendanceDay,
  Category,
  Course,
  HacTable,
  ScheduleEntry,
  StudentInfo,
  Transcript,
} from '@/hac/types';

import { HacClient, type HacCredentials } from './client';

/**
 * Demo account: realistic made-up grades for trying the app without an HAC login
 * (app store reviewers, screenshots, friends without HAC). Nothing is sent anywhere.
 *
 * It's selected by the reserved address `DEMO_URL`; `createClient` returns a DemoClient
 * for it and a real HacClient for everything else.
 */

export const DEMO_URL = 'https://demo.gradegupta.app';
export const DEMO_CREDENTIALS: HacCredentials = { baseUrl: DEMO_URL, username: 'demo', password: 'demo' };

export const isDemo = (baseUrl: string) => baseUrl.replace(/\/+$/, '') === DEMO_URL;

/** A real client, or the demo one for the demo address. */
export function createClient(credentials: HacCredentials): HacClient {
  return isDemo(credentials.baseUrl) ? new DemoClient(credentials) : new HacClient(credentials);
}

const day = 24 * 60 * 60_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString().slice(0, 10);

type Row = [name: string, category: string, score: number | null, total: number, dueOffsetDays: number, extra?: Partial<Assignment>];

function course(
  id: string,
  name: string,
  level: Course['level'],
  categories: Category[],
  rows: Row[],
  hiddenBonus = 0,
): Course {
  const assignments: Assignment[] = rows.map(([n, category, score, totalPoints, due, extra], i) => ({
    id: `${id}|${i}`,
    name: n,
    category,
    score,
    totalPoints,
    dateDue: iso(due),
    dateAssigned: iso(due - 4),
    weight: 1,
    isMissing: false,
    ...extra,
  }));
  const average = computeAverage(categories, assignments).average;
  return {
    id,
    name,
    level,
    credits: 1,
    // A non-zero hiddenBonus makes HAC's average differ from the visible work (the hidden-grade demo).
    reportedAverage: average === null ? null : Math.round((average + hiddenBonus) * 100) / 100,
    categories,
    assignments,
  };
}

const MAJOR_MINOR: Category[] = [
  { name: 'Major', weight: 60 },
  { name: 'Minor', weight: 40 },
];

function demoCourses(period: string): Course[] {
  const shift = period === '1' ? -45 : 0; // first marking period is older
  const d = (n: number) => n + shift;
  return [
    course('DEMO-1', 'AP Statistics', 'ap', MAJOR_MINOR, [
      ['Unit 3 Test', 'Major', 91, 100, d(-6)],
      ['Unit 2 Test', 'Major', 88, 100, d(-20)],
      ['Sampling Quiz', 'Minor', 19, 20, d(-3)],
      ['Probability Homework', 'Minor', 10, 10, d(-10)],
      ['Bonus: Stats in the news', 'Minor', 2, 0, d(-8), { isExtraCredit: true }],
      ['Unit 4 Test', 'Major', null, 100, d(5)],
    ]),
    course('DEMO-2', 'Precalculus Honors', 'honors', MAJOR_MINOR, [
      ['Trig Identities Test', 'Major', 84, 100, d(-5)],
      ['Unit Circle Quiz', 'Minor', 17, 20, d(-12)],
      ['Graphing Homework', 'Minor', 0, 10, d(-2), { isMissing: true }],
      ['Polar Coordinates Quiz', 'Minor', null, 20, d(3)],
    ]),
    course(
      'DEMO-3',
      'AP English Language',
      'ap',
      [
        { name: 'Summative', weight: 70 },
        { name: 'Formative', weight: 30 },
      ],
      [
        ['Rhetorical Analysis Essay', 'Summative', 46, 50, d(-9)],
        ['Synthesis Essay', 'Summative', 42, 50, d(-23)],
        ['Annotation Check', 'Formative', 10, 10, d(-4)],
        ['Argument Essay', 'Summative', null, 50, d(8)],
      ],
      2.1,
    ),
    course('DEMO-4', 'Chemistry', 'regular', MAJOR_MINOR, [
      ['Stoichiometry Test', 'Major', 76, 100, d(-7)],
      ['Lab Report: Titration', 'Minor', 42, 50, d(-11)],
      ['Moles Worksheet', 'Minor', 9, 10, d(-15)],
    ]),
    course('DEMO-5', 'US History', 'regular', MAJOR_MINOR, [
      ['Civil War DBQ', 'Major', 95, 100, d(-6)],
      ['Reconstruction Quiz', 'Minor', 48, 50, d(-13)],
    ]),
    course(
      'DEMO-6',
      'Computer Science Principles',
      'ap',
      [{ name: 'Projects', weight: 100 }],
      [
        ['Create Task Draft', 'Projects', 104, 100, d(-4)],
        ['Data Lab', 'Projects', 50, 50, d(-14)],
      ],
    ),
  ];
}

class DemoClient extends HacClient {
  async login(): Promise<void> {}
  async logout(): Promise<void> {}

  async getAssignments(markingPeriod?: string): Promise<AssignmentsPage> {
    const period = markingPeriod?.startsWith('1') ? '1' : '2';
    return {
      courses: demoCourses(period),
      markingPeriods: [
        { value: '1-2026', label: '1', selected: period === '1' },
        { value: '2-2026', label: '2', selected: period === '2' },
      ],
    };
  }

  async getSchedule(): Promise<ScheduleEntry[]> {
    return demoCourses('2').map((c, i) => ({
      courseCode: c.id,
      name: c.name,
      periods: String(i + 1),
      teacher: ['Rivera, A', 'Chen, M', 'Patel, R', 'Okafor, J', 'Novak, L', 'Kim, S'][i],
      teacherEmail: `teacher${i + 1}@demo.gradegupta.app`,
      room: `B${101 + i}`,
      days: 'A/B',
      markingPeriods: 'Q1-Q4',
    }));
  }

  async getReportCard(): Promise<HacTable> {
    const headers = ['Course', 'Description', '1st', '2nd', 'EXM1', 'SEM1', '3rd', '4th', 'EXM2', 'SEM2'];
    const first = demoCourses('1');
    const second = demoCourses('2');
    return {
      headers,
      rows: first.map((c, i) => ({
        Course: c.id,
        Description: c.name,
        '1st': String(Math.round(c.reportedAverage ?? 0)),
        '2nd': String(Math.round(second[i].reportedAverage ?? 0)),
        EXM1: '',
        SEM1: '',
        '3rd': '',
        '4th': '',
        EXM2: '',
        SEM2: '',
      })),
    };
  }

  async getProgressReport(): Promise<HacTable> {
    return {
      headers: ['Course', 'Description', 'Score'],
      rows: demoCourses('2').map((c) => ({ Course: c.id, Description: c.name, Score: (c.reportedAverage ?? 0).toFixed(2) })),
    };
  }

  async getTranscript(): Promise<Transcript> {
    return {
      courses: [
        { courseCode: 'T1', name: 'English I Honors', year: '2025-2026', gradeLevel: '9', semesters: [94, 96], credits: 1 },
        { courseCode: 'T2', name: 'Geometry Honors', year: '2025-2026', gradeLevel: '9', semesters: [91, 89], credits: 1 },
        { courseCode: 'T3', name: 'Biology', year: '2025-2026', gradeLevel: '9', semesters: [97, 95], credits: 1 },
        { courseCode: 'T4', name: 'AP Human Geography', year: '2025-2026', gradeLevel: '9', semesters: [92, 94], credits: 1 },
      ],
      gpa: { 'Weighted GPA': 4.4, 'Unweighted GPA': 3.92 },
      rank: '48 / 712',
    };
  }

  async getAttendance(): Promise<{ month: string; days: AttendanceDay[] }> {
    const now = new Date();
    const month = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const ym = now.toISOString().slice(0, 7);
    return {
      month,
      days: [
        { date: `${ym}-03`, events: ['Tardy', 'Period 1'] },
        { date: `${ym}-09`, events: ['Excused Absence'] },
        { date: `${ym}-15`, events: ['Tardy', 'Period 4'] },
      ],
    };
  }

  async getStudentInfo(): Promise<StudentInfo> {
    return { name: 'Alex Demo', grade: '10', building: 'GradeGupta Demo High School' };
  }
}
