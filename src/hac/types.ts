/**
 * Domain types for data scraped from Home Access Center (HAC).
 *
 * These are plain data shapes with no behavior so they can be serialized to SQLite,
 * diffed between syncs, and fed straight into the pure grade math in `src/grades/`.
 */

/** Course rigor, used for weighted GPA. Detected from the course name, editable by the user. */
export type CourseLevel = 'regular' | 'honors' | 'ap' | 'ib' | 'dual_credit';

export interface Assignment {
  /** Stable id within a course: built from course code, due date and name. */
  id: string;
  name: string;
  /** Category name, matching one of the course's `categories` (e.g. "Major Grades"). */
  category: string;
  /** Due date as ISO `YYYY-MM-DD`, when HAC provides one. */
  dateDue?: string;
  /** Assigned date as ISO `YYYY-MM-DD`, when HAC provides one. */
  dateAssigned?: string;
  /** Points earned. `null` means not graded yet or excused, and is left out of averages. */
  score: number | null;
  totalPoints: number;
  /** HAC per-assignment multiplier ("Weight" column). Usually 1. */
  weight?: number;
  /** HAC marked the assignment missing (scored as 0). */
  isMissing?: boolean;
  /**
   * Extra credit: points earned on an assignment worth 0 points (HAC shows the total as
   * 0 or blank). Adds to the category's earned points without adding possible points.
   */
  isExtraCredit?: boolean;
  /** User-created "what if" grade that doesn't exist in HAC. */
  isMock?: boolean;
}

export interface Category {
  name: string;
  /** Category weight as a percent, e.g. 60 for "Major Grades". 0 for points-based courses. */
  weight: number;
}

export interface Course {
  /** Section code from HAC, e.g. "3500 - 1". Unique per student per marking period. */
  id: string;
  name: string;
  level: CourseLevel;
  /** Credits the course is worth (HAC rarely exposes this on the assignments page; defaults to 1). */
  credits: number;
  /** Average exactly as HAC displays it. The source of truth when no what-if edits are applied. */
  reportedAverage: number | null;
  categories: Category[];
  assignments: Assignment[];
}

/** One option in HAC's marking-period dropdown (e.g. "1" = first nine weeks). */
export interface MarkingPeriod {
  value: string;
  label: string;
  selected: boolean;
}

/** Result of reading the Assignments page: the courses plus which periods can be switched to. */
export interface AssignmentsPage {
  courses: Course[];
  markingPeriods: MarkingPeriod[];
}

export interface ScheduleEntry {
  courseCode: string;
  name: string;
  periods: string;
  teacher: string;
  teacherEmail?: string;
  room: string;
  days: string;
  markingPeriods: string;
  building?: string;
  status?: string;
}

export interface TranscriptCourse {
  courseCode: string;
  name: string;
  /** School year label, e.g. "2024-2025". */
  year: string;
  /** Grade level that year, e.g. "10". */
  gradeLevel?: string;
  /** Semester grades in order (Sem1, Sem2). `null` when blank. */
  semesters: (number | null)[];
  credits: number | null;
}

export interface Transcript {
  courses: TranscriptCourse[];
  /** GPA rows HAC shows at the bottom (label → value), e.g. { "Weighted GPA": 4.32 }. */
  gpa: Record<string, number>;
  /** Class rank text if the district shows it, e.g. "12 / 640". */
  rank?: string;
}

/** A generic HAC grid: header labels plus one record per row keyed by header. */
export interface HacTable {
  headers: string[];
  rows: Record<string, string>[];
}

export interface StudentInfo {
  name?: string;
  grade?: string;
  building?: string;
  studentId?: string;
}

export interface AttendanceDay {
  /** ISO date `YYYY-MM-DD`. */
  date: string;
  /** Attendance codes or descriptions HAC put on the calendar day, e.g. "Tardy". */
  events: string[];
}
