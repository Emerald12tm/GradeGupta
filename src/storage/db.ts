import * as SQLite from 'expo-sqlite';

import type { Course } from '@/hac/types';

/**
 * Local SQLite database: the only place grade data is stored. Nothing is uploaded anywhere.
 *
 * Tables
 * - `kv`             small JSON values (settings).
 * - `snapshots`      latest scraped courses per marking period. Used for offline viewing and
 *                    for diffing against the next sync to find new grades.
 * - `course_history` one row per course whenever its average changes, for trend charts.
 * - `gpa_history`    one row whenever the current GPA changes.
 * - `todos`          planner items the user adds, with optional reminder notification id.
 *
 * Timestamps are ISO-8601 strings (`new Date().toISOString()`).
 *
 * The database is opened lazily and shared by the UI and the background task.
 */

const SCHEMA_VERSION = 1;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  dbPromise ??= SQLite.openDatabaseAsync('gradegupta.db').then(async (db) => {
    await migrate(db);
    return db;
  });
  return dbPromise;
}

async function migrate(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((row?.user_version ?? 0) >= SCHEMA_VERSION) return;
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS snapshots (
      marking_period TEXT PRIMARY KEY NOT NULL,
      taken_at TEXT NOT NULL,
      courses TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS course_history (
      course_id TEXT NOT NULL,
      course_name TEXT NOT NULL,
      taken_at TEXT NOT NULL,
      average REAL NOT NULL,
      PRIMARY KEY (course_id, taken_at)
    );
    CREATE TABLE IF NOT EXISTS gpa_history (
      taken_at TEXT PRIMARY KEY NOT NULL,
      weighted REAL,
      unweighted REAL
    );
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      due TEXT,
      course_id TEXT,
      done INTEGER NOT NULL DEFAULT 0,
      notification_id TEXT,
      created_at TEXT NOT NULL
    );
    PRAGMA user_version = ${SCHEMA_VERSION};
  `);
}

// ---------- key/value ----------

export async function kvGet<T>(key: string): Promise<T | null> {
  const row = await (await getDb()).getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
  return row ? (JSON.parse(row.value) as T) : null;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await (await getDb()).runAsync(
    'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    JSON.stringify(value),
  );
}

// ---------- snapshots ----------

export interface Snapshot {
  markingPeriod: string;
  takenAt: string;
  courses: Course[];
}

export async function getSnapshot(markingPeriod: string): Promise<Snapshot | null> {
  const row = await (await getDb()).getFirstAsync<{ taken_at: string; courses: string }>(
    'SELECT taken_at, courses FROM snapshots WHERE marking_period = ?',
    markingPeriod,
  );
  return row ? { markingPeriod, takenAt: row.taken_at, courses: JSON.parse(row.courses) } : null;
}

export async function saveSnapshot(snapshot: Snapshot): Promise<void> {
  await (await getDb()).runAsync(
    `INSERT INTO snapshots (marking_period, taken_at, courses) VALUES (?, ?, ?)
     ON CONFLICT(marking_period) DO UPDATE SET taken_at = excluded.taken_at, courses = excluded.courses`,
    snapshot.markingPeriod,
    snapshot.takenAt,
    JSON.stringify(snapshot.courses),
  );
}

// ---------- history ----------

export interface HistoryPoint {
  courseId: string;
  courseName: string;
  takenAt: string;
  average: number;
}

/** Adds a history row for each course whose average differs from its last recorded value. */
export async function recordCourseHistory(courses: Course[], takenAt: string): Promise<void> {
  const db = await getDb();
  for (const c of courses) {
    if (c.reportedAverage === null) continue;
    const last = await db.getFirstAsync<{ average: number }>(
      'SELECT average FROM course_history WHERE course_id = ? ORDER BY taken_at DESC LIMIT 1',
      c.id,
    );
    if (last && Math.abs(last.average - c.reportedAverage) < 0.005) continue;
    await db.runAsync(
      'INSERT OR REPLACE INTO course_history (course_id, course_name, taken_at, average) VALUES (?, ?, ?, ?)',
      c.id,
      c.name,
      takenAt,
      c.reportedAverage,
    );
  }
}

export async function getCourseHistory(courseId?: string): Promise<HistoryPoint[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ course_id: string; course_name: string; taken_at: string; average: number }>(
    courseId
      ? 'SELECT * FROM course_history WHERE course_id = ? ORDER BY taken_at'
      : 'SELECT * FROM course_history ORDER BY taken_at',
    ...(courseId ? [courseId] : []),
  );
  return rows.map((r) => ({ courseId: r.course_id, courseName: r.course_name, takenAt: r.taken_at, average: r.average }));
}

export interface GpaPoint {
  takenAt: string;
  weighted: number | null;
  unweighted: number | null;
}

export async function recordGpa(point: GpaPoint): Promise<void> {
  const db = await getDb();
  const last = await db.getFirstAsync<{ weighted: number | null }>('SELECT weighted FROM gpa_history ORDER BY taken_at DESC LIMIT 1');
  if (last && last.weighted !== null && point.weighted !== null && Math.abs(last.weighted - point.weighted) < 0.0005) return;
  await db.runAsync(
    'INSERT OR REPLACE INTO gpa_history (taken_at, weighted, unweighted) VALUES (?, ?, ?)',
    point.takenAt,
    point.weighted,
    point.unweighted,
  );
}

export async function getGpaHistory(): Promise<GpaPoint[]> {
  const rows = await (await getDb()).getAllAsync<{ taken_at: string; weighted: number | null; unweighted: number | null }>(
    'SELECT * FROM gpa_history ORDER BY taken_at',
  );
  return rows.map((r) => ({ takenAt: r.taken_at, weighted: r.weighted, unweighted: r.unweighted }));
}

// ---------- planner to-dos ----------

export interface Todo {
  id: number;
  title: string;
  /** ISO date-time the item is due / the reminder fires. */
  due: string | null;
  courseId: string | null;
  done: boolean;
  notificationId: string | null;
}

export async function listTodos(): Promise<Todo[]> {
  const rows = await (await getDb()).getAllAsync<{
    id: number;
    title: string;
    due: string | null;
    course_id: string | null;
    done: number;
    notification_id: string | null;
  }>('SELECT * FROM todos ORDER BY done, due IS NULL, due, id');
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    due: r.due,
    courseId: r.course_id,
    done: r.done === 1,
    notificationId: r.notification_id,
  }));
}

export async function addTodo(todo: Omit<Todo, 'id' | 'done'>): Promise<void> {
  await (await getDb()).runAsync(
    'INSERT INTO todos (title, due, course_id, notification_id, created_at) VALUES (?, ?, ?, ?, ?)',
    todo.title,
    todo.due,
    todo.courseId,
    todo.notificationId,
    new Date().toISOString(),
  );
}

export async function setTodoDone(id: number, done: boolean): Promise<void> {
  await (await getDb()).runAsync('UPDATE todos SET done = ? WHERE id = ?', done ? 1 : 0, id);
}

export async function deleteTodo(id: number): Promise<void> {
  await (await getDb()).runAsync('DELETE FROM todos WHERE id = ?', id);
}

/** Wipes everything (used on sign out). */
export async function clearAllData(): Promise<void> {
  await (await getDb()).execAsync(
    'DELETE FROM kv; DELETE FROM snapshots; DELETE FROM course_history; DELETE FROM gpa_history; DELETE FROM todos;',
  );
}
