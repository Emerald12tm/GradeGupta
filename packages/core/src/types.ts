/** Shared domain types used by the mobile app, the website, and the HAC sync API. */

export type CourseLevel = 'regular' | 'honors' | 'ap' | 'ib' | 'dual_credit';

export interface Assignment {
  id: string;
  name: string;
  category: string;
  dateDue?: string; // ISO date
  dateAssigned?: string; // ISO date
  /** Points earned. `null` = not graded yet / excused (excluded from averages). */
  score: number | null;
  totalPoints: number;
  /** HAC per-assignment multiplier (usually 1). */
  weight?: number;
  isMissing?: boolean;
  /** True for user-created "what if" grades that don't exist in HAC. */
  isMock?: boolean;
}

export interface Category {
  name: string;
  /** Category weight as a percent (e.g. 60 for tests). */
  weight: number;
}

export interface Course {
  id: string;
  name: string;
  teacher?: string;
  teacherEmail?: string;
  period?: string;
  room?: string;
  level: CourseLevel;
  credits: number;
  /** Average as reported by HAC (source of truth when no mocks are applied). */
  reportedAverage: number | null;
  categories: Category[];
  assignments: Assignment[];
}

export interface TranscriptCourse {
  name: string;
  year: string; // e.g. "2025-2026"
  term: string; // e.g. "S1"
  grade: number; // percent
  credits: number;
  level: CourseLevel;
}
