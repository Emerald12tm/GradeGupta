import type { GpaPoint, HistoryPoint, Snapshot, Todo } from './db';

/**
 * Grade-history backup file. Lets users keep their trend history when they switch phones:
 * export to a file (save it to iCloud Drive / Google Drive from the share sheet), then
 * import it on the new phone.
 *
 * The file never contains passwords or HAC usernames, only grades, history and to-dos.
 * It is not encrypted, so the export screen tells users to store it somewhere private.
 */

export const BACKUP_VERSION = 1;

export interface Backup {
  app: 'GradeGupta';
  version: number;
  exportedAt: string;
  snapshots: Snapshot[];
  courseHistory: HistoryPoint[];
  gpaHistory: GpaPoint[];
  todos: Pick<Todo, 'title' | 'due' | 'courseId' | 'done'>[];
}

export function makeBackup(parts: Omit<Backup, 'app' | 'version' | 'exportedAt'>, now = new Date()): Backup {
  return {
    app: 'GradeGupta',
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    snapshots: parts.snapshots,
    courseHistory: parts.courseHistory,
    gpaHistory: parts.gpaHistory,
    todos: parts.todos.map(({ title, due, courseId, done }) => ({ title, due, courseId, done })),
  };
}

/** Parses and validates a backup file. Throws an Error with a user-facing message if it's not one. */
export function parseBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file isn’t a GradeGupta backup.');
  }
  const b = data as Partial<Backup>;
  if (!b || b.app !== 'GradeGupta' || typeof b.version !== 'number') throw new Error('That file isn’t a GradeGupta backup.');
  if (b.version > BACKUP_VERSION) throw new Error('This backup is from a newer version of GradeGupta. Update the app first.');
  const arrays = [b.snapshots, b.courseHistory, b.gpaHistory, b.todos];
  if (!arrays.every(Array.isArray)) throw new Error('This backup file is damaged.');
  return b as Backup;
}
