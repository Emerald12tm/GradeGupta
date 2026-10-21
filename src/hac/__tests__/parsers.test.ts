import { computeAverage } from '@/grades/average';

import { normalizeBaseUrl } from '../endpoints';
import { parseAssignmentsPage, splitHeading } from '../parsers/assignments';
import { buildLoginForm, buildMarkingPeriodForm, isLoginPage, loginErrorMessage } from '../parsers/forms';
import { parseAttendance, parseReportCard, parseSchedule, parseStudentInfo, parseTranscript, semesterColumns } from '../parsers/pages';

import * as F from './fixtures';

describe('assignments page', () => {
  const page = parseAssignmentsPage(F.assignmentsPage());
  const [physics, algebra] = page.courses;

  it('reads every course with its code, name, level and average', () => {
    expect(page.courses).toHaveLength(2);
    expect(physics).toMatchObject({ id: '3500 - 1', name: 'AP Physics 1', level: 'ap', reportedAverage: 86 });
    expect(algebra).toMatchObject({ id: '1234 - 2', name: 'Algebra II H', level: 'honors', reportedAverage: 35 });
  });

  it('reads category weights without the Total row', () => {
    expect(physics.categories).toEqual([
      { name: 'Major', weight: 60 },
      { name: 'Daily', weight: 40 },
    ]);
  });

  it('reads assignments with ISO dates, cleaned names and ungraded scores', () => {
    expect(physics.assignments[0]).toMatchObject({
      name: 'Unit 1 Test',
      category: 'Major',
      dateDue: '2026-09-12',
      dateAssigned: '2026-09-08',
      score: 80,
      totalPoints: 100,
      weight: 1,
      isMissing: false,
    });
    expect(physics.assignments[1].name).toBe('Lab 1');
    expect(physics.assignments[3].score).toBeNull();
  });

  it('treats M as missing (0) and X as excused (null), with unique ids for duplicates', () => {
    expect(algebra.assignments.map((a) => [a.score, a.isMissing])).toEqual([
      [70, false],
      [0, true],
      [null, false],
    ]);
    expect(new Set(algebra.assignments.map((a) => a.id)).size).toBe(3);
  });

  it('recomputes to the same average HAC shows', () => {
    expect(computeAverage(physics.categories, physics.assignments).average).toBeCloseTo(86, 6);
    expect(computeAverage(algebra.categories, algebra.assignments).average).toBeCloseTo(35, 6);
  });

  it('lists marking periods', () => {
    expect(page.markingPeriods).toEqual([
      { value: '1-2026', label: '1', selected: true },
      { value: '2-2026', label: '2', selected: false },
    ]);
  });

  it('splits headings with or without wide gaps', () => {
    expect(splitHeading('3500 - 1    AP Physics 1')).toEqual({ code: '3500 - 1', name: 'AP Physics 1' });
    expect(splitHeading('3500 - 1 AP Physics 1')).toEqual({ code: '3500 - 1', name: 'AP Physics 1' });
  });
});

describe('forms', () => {
  it('builds the login form from the page', () => {
    const form = buildLoginForm(F.LOGIN_PAGE, 'student', 'pw');
    expect(form.get('__RequestVerificationToken')).toBe('tok123');
    expect(form.get('Database')).toBe('10');
    expect(form.get('LogOnDetails.UserName')).toBe('student');
    expect(form.get('LogOnDetails.Password')).toBe('pw');
    expect(form.get('VerificationOption')).toBe('UsernamePassword');
  });

  it('detects the login page and its error', () => {
    expect(isLoginPage(F.LOGIN_PAGE)).toBe(true);
    expect(isLoginPage(F.HOME_PAGE)).toBe(false);
    expect(loginErrorMessage(F.LOGIN_FAILED_PAGE)).toBe('Your attempt to log in was unsuccessful.');
  });

  it('builds the marking period postback with view state', () => {
    const form = buildMarkingPeriodForm(F.assignmentsPage(), '2-2026');
    expect(form.get('ctl00$plnMain$ddlReportCardRuns')).toBe('2-2026');
    expect(form.get('__VIEWSTATE')).toBe('vs==');
    expect(form.get('__EVENTVALIDATION')).toBe('ev==');
    expect(form.get('__EVENTTARGET')).toBe('ctl00$plnMain$btnRefreshView');
    expect(form.get('ctl00$plnMain$ddlClasses')).toBe('ALL');
  });
});

describe('other pages', () => {
  it('schedule with teacher email', () => {
    const s = parseSchedule(F.SCHEDULE_PAGE);
    expect(s).toHaveLength(2);
    expect(s[0]).toMatchObject({ courseCode: '3500 - 1', name: 'AP Physics 1', teacher: 'Smith, Jane', teacherEmail: 'teacher@district.example', room: 'B204' });
    expect(s[1].teacherEmail).toBeUndefined();
  });

  it('transcript courses, GPA and rank', () => {
    const t = parseTranscript(F.TRANSCRIPT_PAGE);
    expect(t.courses).toEqual([
      { courseCode: '3400', name: 'AP World History', year: '2025-2026', gradeLevel: '10', semesters: [93, 95], credits: 1 },
      { courseCode: '1200', name: 'Geometry H', year: '2025-2026', gradeLevel: '10', semesters: [88, null], credits: 0.5 },
    ]);
    expect(t.gpa).toEqual({ 'Weighted GPA': 4.3215, 'Unweighted GPA': 3.91 });
    expect(t.rank).toBe('12 / 640');
  });

  it('report card and its semester columns', () => {
    const rc = parseReportCard(F.REPORT_CARD_PAGE);
    expect(rc.rows[0]).toMatchObject({ Description: 'AP Physics 1', '1st': '92', '2nd': '88', EXM1: '84', SEM1: '89' });
    expect(semesterColumns(rc.headers)).toEqual([
      { periods: ['1st', '2nd'], exam: 'EXM1', semester: 'SEM1' },
      { periods: ['3rd', '4th'], exam: 'EXM2', semester: 'SEM2' },
    ]);
  });

  it('semester columns for six-weeks districts', () => {
    expect(semesterColumns(['Course', 'C1', 'C2', 'C3', 'E1', 'S1'])).toEqual([{ periods: ['C1', 'C2', 'C3'], exam: 'E1', semester: 'S1' }]);
  });

  it('attendance days', () => {
    const a = parseAttendance(F.ATTENDANCE_PAGE);
    expect(a.month).toBe('October 2026');
    expect(a.days).toEqual([
      { date: '2026-10-02', events: ['Tardy', 'Period 1'] },
      { date: '2026-10-14', events: ['Excused Absence'] },
    ]);
  });

  it('student info', () => {
    expect(parseStudentInfo(F.REGISTRATION_PAGE)).toMatchObject({ name: 'Test Student', grade: '11', building: 'Example High School' });
  });
});

describe('normalizeBaseUrl', () => {
  it.each([
    ['hac.friscoisd.org', 'https://hac.friscoisd.org'],
    ['https://homeaccess.katyisd.org/HomeAccess/Account/LogOn?x=1', 'https://homeaccess.katyisd.org'],
    ['http://hac.example.org', 'https://hac.example.org'],
    ['  HAC.Example.org/  ', 'https://hac.example.org'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeBaseUrl(input)).toBe(expected);
  });

  it('rejects junk', () => {
    expect(() => normalizeBaseUrl('')).toThrow();
    expect(() => normalizeBaseUrl('localhost')).toThrow();
    expect(() => normalizeBaseUrl('ftp://hac.example.org')).toThrow();
  });
});
