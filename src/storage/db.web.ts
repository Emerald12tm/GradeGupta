import type { Course } from '@/hac/types';

import type { GpaPoint, HistoryPoint, Snapshot, Todo } from './db';

/**
 * Web preview stand-in for `db.ts` (Metro picks `.web.ts` in the browser).
 *
 * expo-sqlite on the web needs cross-origin isolation headers that the dev server doesn't
 * send, and the web build can't sign in to HAC anyway (browsers block cross-site requests),
 * so the browser only needs storage that works for previewing screens. Same API as
 * `db.ts`; data lives in memory, per account, and is gone on reload.
 */

export type { GpaPoint, HistoryPoint, Snapshot, Todo };

interface AccountData {
  snapshots: Map<string, Snapshot>;
  courseHistory: HistoryPoint[];
  gpaHistory: GpaPoint[];
  todos: Todo[];
}

const kv = new Map<string, string>();
const accounts = new Map<string, AccountData>();
let activeAccountId: string | null = null;
let nextTodoId = 1;

export function setActiveAccount(id: string | null): void {
  activeAccountId = id;
}

function data(accountId?: string): AccountData {
  const id = accountId ?? activeAccountId ?? 'default';
  let d = accounts.get(id);
  if (!d) {
    d = { snapshots: new Map(), courseHistory: [], gpaHistory: [], todos: [] };
    accounts.set(id, d);
  }
  return d;
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const value = kv.get(key);
  return value === undefined ? null : (JSON.parse(value) as T);
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  kv.set(key, JSON.stringify(value));
}

export async function getSnapshot(markingPeriod: string, accountId?: string): Promise<Snapshot | null> {
  return data(accountId).snapshots.get(markingPeriod) ?? null;
}

export async function saveSnapshot(snapshot: Snapshot, accountId?: string): Promise<void> {
  data(accountId).snapshots.set(snapshot.markingPeriod, snapshot);
}

export async function recordCourseHistory(courses: Course[], takenAt: string, accountId?: string): Promise<void> {
  const history = data(accountId).courseHistory;
  for (const c of courses) {
    if (c.reportedAverage === null) continue;
    const last = history.filter((h) => h.courseId === c.id).at(-1);
    if (last && Math.abs(last.average - c.reportedAverage) < 0.005) continue;
    history.push({ courseId: c.id, courseName: c.name, takenAt, average: c.reportedAverage });
  }
}

export async function getCourseHistory(courseId?: string, accountId?: string): Promise<HistoryPoint[]> {
  const history = data(accountId).courseHistory;
  return courseId ? history.filter((h) => h.courseId === courseId) : [...history];
}

export async function recordGpa(point: GpaPoint, accountId?: string): Promise<void> {
  data(accountId).gpaHistory.push(point);
}

export async function getGpaHistory(accountId?: string): Promise<GpaPoint[]> {
  return [...data(accountId).gpaHistory];
}

export async function listTodos(accountId?: string): Promise<Todo[]> {
  return [...data(accountId).todos].sort(
    (a, b) => Number(a.done) - Number(b.done) || (a.due ?? '~').localeCompare(b.due ?? '~'),
  );
}

export async function addTodo(todo: Omit<Todo, 'id' | 'done'>, accountId?: string): Promise<void> {
  data(accountId).todos.push({ ...todo, id: nextTodoId++, done: false });
}

export async function setTodoDone(id: number, done: boolean, accountId?: string): Promise<void> {
  const d = data(accountId);
  d.todos = d.todos.map((t) => (t.id === id ? { ...t, done } : t));
}

export async function deleteTodo(id: number, accountId?: string): Promise<void> {
  const d = data(accountId);
  d.todos = d.todos.filter((t) => t.id !== id);
}

export async function deleteAccountData(accountId: string): Promise<void> {
  accounts.delete(accountId);
}
