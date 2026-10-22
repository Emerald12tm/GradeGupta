import * as SQLite from 'expo-sqlite';

import type { Course } from '@/hac/types';

/**
 * Local SQLite storage. Nothing is uploaded anywhere.
 *
 * Two kinds of database file:
 * - `gradegupta.db` (global): `kv` for app settings shared by every account.
 * - `account-<id>.db` (one per saved HAC account): that student's grade data, so switching
 *   accounts never mixes grades.
 *     - `snapshots`      latest scraped courses per marking period (offline view + diffing).
 *     - `course_history` a row per course whenever its average changes (trend charts).
 *     - `gpa_history`    a row whenever the current GPA changes.
 *     - `todos`          planner items, with the id of their reminder notification.
 *
 * Account data functions take an optional `accountId`; without it they use the active
 * account (`setActiveAccount`, called by the session). The background task passes ids
 * explicitly so it can sync every account without touching the UI's active one.
 *
 * Timestamps are ISO-8601 strings.
 */

const GLOBAL_SCHEMA_VERSION = 1;
const ACCOUNT_SCHEMA_VERSION = 1;

const open = new Map<string, Promise<SQLite.SQLiteDatabase>>();
let activeAccountId: string | null = null;

export function setActiveAccount(id: string | null): void {
  activeAccountId = id;
}

const accountDbName = (id: string) => `account-${id}.db`;

function openDb(name: string, migrate: (db: SQLite.SQLiteDatabase) => Promise<void>): Promise<SQLite.SQLiteDatabase> {
  let db = open.get(name);
  if (!db) {
    db = SQLite.openDatabaseAsync(name).then(async (d) => {
      await migrate(d);
      return d;
    });
    open.set(name, db);
  }
  return db;
}

const globalDb = () =>
  openDb('gradegupta.db', async (db) => {
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if ((row?.user_version ?? 0) >= GLOBAL_SCHEMA_VERSION) return;
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
      PRAGMA user_version = ${GLOBAL_SCHEMA_VERSION};
    `);
  });

function accountDb(accountId?: string): Promise<SQLite.SQLiteDatabase> {
  const id = accountId ?? activeAccountId;
  if (!id) return Promise.reject(new Error('No active account'));
  return openDb(accountDbName(id), async (db) => {
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if ((row?.user_version ?? 0) >= ACCOUNT_SCHEMA_VERSION) return;
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
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
      PRAGMA user_version = ${ACCOUNT_SCHEMA_VERSION};
    `);
  });
}

// ---------- key/value (global) ----------

export async function kvGet<T>(key: string): Promise<T | null> {
  const row = await (await globalDb()).getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
  return row ? (JSON.parse(row.value) as T) : null;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await (await globalDb()).runAsync(
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

export async function getSnapshot(markingPeriod: string, accountId?: string): Promise<Snapshot | null> {
  const row = await (await accountDb(accountId)).getFirstAsync<{ taken_at: string; courses: string }>(
    'SELECT taken_at, courses FROM snapshots WHERE marking_period = ?',
    markingPeriod,
  );
  return row ? { markingPeriod, takenAt: row.taken_at, courses: JSON.parse(row.courses) } : null;
}

export async function saveSnapshot(snapshot: Snapshot, accountId?: string): Promise<void> {
  await (await accountDb(accountId)).runAsync(
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
export async function recordCourseHistory(courses: Course[], takenAt: string, accountId?: string): Promise<void> {
  const db = await accountDb(accountId);
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

export async function getCourseHistory(courseId?: string, accountId?: string): Promise<HistoryPoint[]> {
  const db = await accountDb(accountId);
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

export async function recordGpa(point: GpaPoint, accountId?: string): Promise<void> {
  const db = await accountDb(accountId);
  const last = await db.getFirstAsync<{ weighted: number | null }>('SELECT weighted FROM gpa_history ORDER BY taken_at DESC LIMIT 1');
  if (last && last.weighted !== null && point.weighted !== null && Math.abs(last.weighted - point.weighted) < 0.0005) return;
  await db.runAsync(
    'INSERT OR REPLACE INTO gpa_history (taken_at, weighted, unweighted) VALUES (?, ?, ?)',
    point.takenAt,
    point.weighted,
    point.unweighted,
  );
}

export async function getGpaHistory(accountId?: string): Promise<GpaPoint[]> {
  const rows = await (await accountDb(accountId)).getAllAsync<{ taken_at: string; weighted: number | null; unweighted: number | null }>(
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

export async function listTodos(accountId?: string): Promise<Todo[]> {
  const rows = await (await accountDb(accountId)).getAllAsync<{
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

export async function addTodo(todo: Omit<Todo, 'id' | 'done'>, accountId?: string): Promise<void> {
  await (await accountDb(accountId)).runAsync(
    'INSERT INTO todos (title, due, course_id, notification_id, created_at) VALUES (?, ?, ?, ?, ?)',
    todo.title,
    todo.due,
    todo.courseId,
    todo.notificationId,
    new Date().toISOString(),
  );
}

export async function setTodoDone(id: number, done: boolean, accountId?: string): Promise<void> {
  await (await accountDb(accountId)).runAsync('UPDATE todos SET done = ? WHERE id = ?', done ? 1 : 0, id);
}

export async function deleteTodo(id: number, accountId?: string): Promise<void> {
  await (await accountDb(accountId)).runAsync('DELETE FROM todos WHERE id = ?', id);
}

/** Deletes one account's database file (used when the account is removed). */
export async function deleteAccountData(accountId: string): Promise<void> {
  const name = accountDbName(accountId);
  const db = open.get(name);
  open.delete(name);
  if (db) await (await db).closeAsync();
  await SQLite.deleteDatabaseAsync(name).catch(() => {});
}
