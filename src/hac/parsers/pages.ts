import type { AttendanceDay, HacTable, ScheduleEntry, StudentInfo, Transcript, TranscriptCourse } from '@/hac/types';

import { byIdSuffix, cleanText, parseHtml, parseNumber, pick, readTable } from '../html';

/**
 * Parsers for the smaller HAC pages: schedule, transcript, report card, progress report,
 * attendance calendar and student info. Each takes the page's HTML and returns plain data.
 */

/** `Content/Student/Classes.aspx` → class schedule, including teacher email links. */
export function parseSchedule(html: string): ScheduleEntry[] {
  const root = parseHtml(html);
  return readTable(byIdSuffix(root, 'dgSchedule', 'table')).rows.map(({ values: v, cells }) => {
    const mail = cells.Teacher?.querySelector('a[href^="mailto:"]')?.getAttribute('href');
    return {
      courseCode: pick(v, 'Course') ?? '',
      name: pick(v, 'Description', /course name/i) ?? '',
      periods: pick(v, 'Periods', /period/i) ?? '',
      teacher: pick(v, 'Teacher') ?? '',
      teacherEmail: mail ? mail.replace(/^mailto:/i, '') : undefined,
      room: pick(v, 'Room') ?? '',
      days: pick(v, 'Days') ?? '',
      markingPeriods: pick(v, 'Marking Periods', /marking/i) ?? '',
      building: pick(v, 'Building'),
      status: pick(v, 'Status'),
    };
  });
}

/**
 * `Content/Student/Transcript.aspx` → every past course with semester grades and credits,
 * plus the cumulative GPA block and class rank when the district shows them.
 */
export function parseTranscript(html: string): Transcript {
  const root = parseHtml(html);
  const courses: TranscriptCourse[] = [];

  for (const group of root.querySelectorAll('.sg-transcript-group')) {
    const year = cleanText(byIdSuffix(group, 'lblYearValue'));
    const gradeLevel = cleanText(byIdSuffix(group, 'lblGradeValue')) || undefined;
    const table = readTable(byIdSuffix(group, 'dgCourses', 'table'));
    const semesterHeaders = table.headers.filter((h) => /^(sem|s)\s*\d$/i.test(h.replace(/\s+/g, '')) || /^sem\s*\d/i.test(h));

    for (const { values: v } of table.rows) {
      const code = pick(v, 'Course') ?? '';
      if (!code || /total/i.test(code)) continue;
      courses.push({
        courseCode: code,
        name: pick(v, 'Description') ?? code,
        year,
        gradeLevel,
        semesters: semesterHeaders.map((h) => parseNumber(v[h])),
        credits: parseNumber(pick(v, 'CRD', /cr(e)?d/i)),
      });
    }
  }

  const gpa: Record<string, number> = {};
  const gpaTable = byIdSuffix(root, 'tblCumGPAInfo', 'table');
  for (const row of gpaTable?.querySelectorAll('tr') ?? []) {
    const cells = row.querySelectorAll('td').map((c) => cleanText(c));
    // Rows look like ["Weighted GPA", "4.3215"]; skip headers and blanks.
    for (let i = 0; i + 1 < cells.length; i += 2) {
      const value = parseNumber(cells[i + 1]);
      if (cells[i] && value !== null && !/^\d/.test(cells[i])) gpa[cells[i]] = value;
    }
  }

  const rankEl = byIdSuffix(root, 'lblRankValue') ?? byIdSuffix(root, 'lblRank');
  return { courses, gpa, rank: cleanText(rankEl) || undefined };
}

function genericTable(html: string, idSuffix: string): HacTable {
  const { headers, rows } = readTable(byIdSuffix(parseHtml(html), idSuffix, 'table'));
  return { headers: headers.filter(Boolean), rows: rows.map((r) => r.values) };
}

/** `Content/Student/ReportCards.aspx` → the report card grid as-is (columns vary by district). */
export const parseReportCard = (html: string): HacTable => genericTable(html, 'dgReportCard');

/** `Content/Student/InterimProgress.aspx` → progress report grid. */
export const parseProgressReport = (html: string): HacTable => genericTable(html, 'dgIPR');

export interface SemesterColumns {
  /** Report card headers for each grading period in this semester, e.g. ["1st", "2nd"]. */
  periods: string[];
  exam?: string;
  semester: string;
}

/**
 * Groups report card columns into semesters so the final exam calculator can be pre-filled.
 * Recognizes headers like "1st"/"2nd"/"C1"/"Q1" for periods, "EXM1"/"Exam1"/"E1" for exams and
 * "SEM1"/"Sem 1"/"S1" for semester grades.
 */
export function semesterColumns(headers: string[]): SemesterColumns[] {
  const isSemester = (h: string) => /^(sem|s)\s*\d$/i.test(h.trim()) || /^sem(ester)?\s*\d/i.test(h.trim());
  const isExam = (h: string) => /^(ex(a)?m?|e|fe|final)\s*\d?$/i.test(h.trim());
  const isPeriod = (h: string) => /^(\d(st|nd|rd|th)?|(c|q|p|mp|cyc|cycle|nw)\s*\d)$/i.test(h.trim());

  const groups: SemesterColumns[] = [];
  let periods: string[] = [];
  let exam: string | undefined;
  for (const h of headers) {
    if (isSemester(h)) {
      groups.push({ periods, exam, semester: h });
      periods = [];
      exam = undefined;
    } else if (isExam(h)) {
      exam = h;
    } else if (isPeriod(h)) {
      periods.push(h);
    }
  }
  return groups.filter((g) => g.periods.length > 0);
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/**
 * `Content/Attendance/MonthlyView.aspx` → days in the displayed month that have attendance
 * events. HAC renders a calendar; days with events carry the description in `title`.
 */
export function parseAttendance(html: string): { month: string; days: AttendanceDay[] } {
  const root = parseHtml(html);
  const calendar = byIdSuffix(root, 'cldAttendance', 'table') ?? root;

  // The month caption looks like "October 2026".
  const caption = calendar
    .querySelectorAll('td, th, span')
    .map((el) => cleanText(el))
    .find((t) => /^[A-Za-z]+ \d{4}$/.test(t) && MONTHS.includes(t.split(' ')[0].toLowerCase()));
  const [monthName = '', yearText = ''] = (caption ?? '').split(' ');
  const month = MONTHS.indexOf(monthName.toLowerCase()) + 1;

  const days: AttendanceDay[] = [];
  for (const cell of calendar.querySelectorAll('td[title]')) {
    const title = (cell.getAttribute('title') ?? '').trim();
    const day = parseNumber(cleanText(cell));
    if (!title || day === null || month === 0) continue;
    days.push({
      date: `${yearText}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      events: title.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
    });
  }
  return { month: caption ?? '', days };
}

/** `Content/Student/Registration.aspx` → name, grade level, campus. */
export function parseStudentInfo(html: string): StudentInfo {
  const root = parseHtml(html);
  const text = (suffix: string) => cleanText(byIdSuffix(root, suffix)) || undefined;
  return {
    name: text('lblRegStudentName') ?? text('lblStudentName'),
    grade: text('lblGrade'),
    building: text('lblBuildingName') ?? text('lblBuilding'),
    studentId: text('lblRegStudentID') ?? text('lblStudentId'),
  };
}
