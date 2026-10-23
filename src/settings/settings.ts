import { create } from 'zustand';

import { DEFAULT_THEME_ID } from '@/constants/theme';
import { DEFAULT_GPA_PRESET, GPA_PRESETS, type GpaScale } from '@/grades/gpa';
import { SEMESTER_PRESETS, type SemesterWeights } from '@/grades/semester';
import type { Course, CourseLevel } from '@/hac/types';
import { kvGet, kvSet } from '@/storage/db';

/**
 * User settings, saved as one JSON value in the local database.
 *
 * Read in React with `useSettings()`; read outside React (background task) with
 * `loadSettings()`. Unknown or missing fields fall back to `DEFAULT_SETTINGS`, so adding
 * a setting never breaks existing installs.
 */

export interface CourseOverride {
  /** Rigor for weighted GPA when the name-based guess is wrong. */
  level?: CourseLevel;
  /** Credits (e.g. 0.5 for a semester course). */
  credits?: number;
  /** Leave the course out of GPA (e.g. athletics, pass/fail). */
  excludeFromGpa?: boolean;
  /** Target average for the class (e.g. 90). Shown on the class page; alerts when it slips. */
  goal?: number;
}

export type TextScale = 'default' | 'large' | 'larger';
export const TEXT_SCALE_FACTOR: Record<TextScale, number> = { default: 1, large: 1.12, larger: 1.25 };

export interface Settings {
  /** Key of `GPA_PRESETS`, or 'custom' to use `customGpaScale`. */
  gpaPreset: string;
  customGpaScale?: GpaScale;
  /** Id from `SEMESTER_PRESETS`, or 'custom' to use `customSemester`. */
  semesterPreset: string;
  customSemester?: SemesterWeights;
  /** Notify when a new grade posts or an existing one changes. */
  notifyGrades: boolean;
  /** Notify when a class average moves by at least `minAverageChange` points. */
  notifyAverages: boolean;
  minAverageChange: number;
  /** Notify when any class average falls below this. `null` = off. */
  lowGradeAlert: number | null;
  /** Check HAC periodically in the background. */
  backgroundSync: boolean;
  /** Require Face ID / fingerprint to open the app. */
  biometricLock: boolean;
  /** Keyed by course name (stable across marking periods, unlike section codes). */
  courseOverrides: Record<string, CourseOverride>;
  /** Color theme id from `THEMES` (src/constants/theme.ts). */
  themeId: string;
  /** Light/dark choice. 'system' follows the phone. */
  appearance: 'system' | 'light' | 'dark';
  /** Bumped when a default changes in a way saved settings should pick up (see `migrate`). */
  version: number;
  /** App text size on top of the phone's own setting. */
  textScale: TextScale;
  /** Sunday-evening summary notification. */
  weeklyDigest: boolean;
  /** Keep HAC due dates in a "GradeGupta" phone calendar. */
  calendarSync: boolean;
}

const SETTINGS_VERSION = 2;

export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  textScale: 'default',
  weeklyDigest: true,
  calendarSync: false,
  themeId: DEFAULT_THEME_ID,
  appearance: 'system',
  gpaPreset: DEFAULT_GPA_PRESET,
  semesterPreset: SEMESTER_PRESETS[0].id,
  notifyGrades: true,
  notifyAverages: false,
  minAverageChange: 1,
  lowGradeAlert: null,
  backgroundSync: true,
  biometricLock: false,
  courseOverrides: {},
};

const KEY = 'settings';

export async function loadSettings(): Promise<Settings> {
  const saved = await kvGet<Partial<Settings>>(KEY);
  return migrate({ ...DEFAULT_SETTINGS, ...saved, version: saved?.version ?? 1 });
}

/**
 * Upgrades settings saved by older versions.
 * v2: the default final exam weight became 20% (40/40/20). Settings saved before then
 * carried the old 15% default without the user choosing it, so move them to the new default.
 */
export function migrate(s: Settings): Settings {
  let out = s;
  if (out.version < 2 && out.semesterPreset === '2x42.5+15') out = { ...out, semesterPreset: '2x40+20' };
  return { ...out, version: SETTINGS_VERSION };
}

export function gpaScaleFor(s: Settings): GpaScale {
  if (s.gpaPreset === 'custom' && s.customGpaScale) return s.customGpaScale;
  return (GPA_PRESETS[s.gpaPreset] ?? GPA_PRESETS[DEFAULT_GPA_PRESET]).scale;
}

export function semesterWeightsFor(s: Settings): SemesterWeights {
  if (s.semesterPreset === 'custom' && s.customSemester) return s.customSemester;
  return SEMESTER_PRESETS.find((p) => p.id === s.semesterPreset) ?? SEMESTER_PRESETS[0];
}

/** Applies the user's per-course level/credit corrections. */
export function applyCourseOverrides(courses: Course[], overrides: Settings['courseOverrides']): Course[] {
  return courses.map((c) => {
    const o = overrides[c.name];
    return o ? { ...c, level: o.level ?? c.level, credits: o.credits ?? c.credits } : c;
  });
}

interface SettingsState {
  settings: Settings;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  update: (patch: Partial<Settings>) => Promise<void>;
  setCourseOverride: (courseName: string, patch: CourseOverride) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  hydrated: false,
  hydrate: async () => {
    set({ settings: await loadSettings(), hydrated: true });
  },
  update: async (patch) => {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    await kvSet(KEY, settings);
  },
  setCourseOverride: async (courseName, patch) => {
    const current = get().settings.courseOverrides;
    await get().update({ courseOverrides: { ...current, [courseName]: { ...current[courseName], ...patch } } });
  },
}));

export const useSettings = (): Settings => useSettingsStore((s) => s.settings);
